using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Rass.Api.Services;

public class AIChatService
{
    private readonly ILogger<AIChatService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public AIChatService(
        ILogger<AIChatService> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public async Task<string> ProcessQueryAsync(string userMessage, string userRole)
    {
        return await ProcessRoleQueryAsync(userMessage, userRole, null);
    }

    public async Task<string> ProcessRoleQueryAsync(string userMessage, string userRole, string? structuredContextJson)
    {
        if (string.IsNullOrWhiteSpace(userMessage))
            throw new InvalidOperationException("Question is required.");

        var apiKey = ResolveApiKey();
        var endpoint = _configuration["AI:LLM:Endpoint"] ?? "https://api.openai.com/v1/chat/completions";
        var model = _configuration["AI:LLM:Model"] ?? "openai/gpt-oss-120b";
        var fallbackModels = (_configuration["AI:LLM:FallbackModels"] ?? "llama-3.3-70b-versatile,openai/gpt-oss-20b")
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var keyHeader = _configuration["AI:LLM:ApiKeyHeader"] ?? "Authorization";
        var useBearer = !string.Equals(_configuration["AI:LLM:RawApiKeyHeader"], "true", StringComparison.OrdinalIgnoreCase);
        var temperature = double.TryParse(_configuration["AI:LLM:Temperature"], out var t) ? t : 0.25;

        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("LLM API key is not configured. Set AI:LLM:ApiKey (or GROQ_API_KEY / OPENAI_API_KEY).");

        var systemPrompt =
            "You are the national RASS AI advisor for agriculture operations. " +
            $"Current user role: {userRole}. " +
            "Answer only what is asked, with tight, role-relevant guidance grounded in the provided platform context. " +
            "When data is missing, explicitly note assumptions and the next data to collect; never invent numbers. " +
            "Keep outputs crisp: at most 4 bullet points or 5 short sentences, no tables, no decorative symbols. " +
            "For greetings or small talk, respond politely in one short sentence without operational checklists. " +
            "If the user changes topic, switch cleanly without repeating prior action lists. " +
            "Reply in the same language as the latest user message (English or Kinyarwanda).";

        var contextSnippet = string.IsNullOrWhiteSpace(structuredContextJson)
            ? "No structured context provided."
            : structuredContextJson;

        var attemptedModels = new List<string>();
        foreach (var candidate in new[] { model }.Concat(fallbackModels).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            attemptedModels.Add(candidate);
            var payload = new
            {
                model = candidate,
                temperature,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = $"Platform context JSON:\n{contextSnippet}\n\nUser question:\n{userMessage.Trim()}" }
                }
            };

            var client = _httpClientFactory.CreateClient();
            using var req = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };

            if (string.Equals(keyHeader, "Authorization", StringComparison.OrdinalIgnoreCase))
            {
                if (useBearer) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                else req.Headers.TryAddWithoutValidation("Authorization", apiKey);
            }
            else
            {
                req.Headers.TryAddWithoutValidation(keyHeader, useBearer ? $"Bearer {apiKey}" : apiKey);
            }

            var res = await client.SendAsync(req);
            var body = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("LLM request failed for model {Model}: {Status} {Body}", candidate, (int)res.StatusCode, body);
                continue;
            }

            try
            {
                using var doc = JsonDocument.Parse(body);
                var content = doc.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString();

                if (string.IsNullOrWhiteSpace(content))
                    throw new InvalidOperationException("LLM returned empty content.");

                return content.Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed parsing LLM response body for model {Model}.", candidate);
            }
        }

        throw new InvalidOperationException($"LLM request failed for all configured models: {string.Join(", ", attemptedModels)}.");
    }

    private string? ResolveApiKey()
    {
        static bool IsUsable(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            var trimmed = value.Trim();
            if (trimmed.StartsWith("${", StringComparison.Ordinal) && trimmed.EndsWith("}", StringComparison.Ordinal)) return false;
            return true;
        }

        var candidates = new[]
        {
            _configuration["AI:LLM:ApiKey"],
            _configuration["AI:ApiKey"],
            _configuration["Groq:ApiKey"],
            _configuration["AI:LLM:RassApi"],
            _configuration["AI:LLM:Rass Api"],
            _configuration["LLM_API_KEY"],
            _configuration["OPENAI_API_KEY"],
            _configuration["GROQ_API_KEY"],
            _configuration["RASS_API_KEY"],
            Environment.GetEnvironmentVariable("AI__LLM__ApiKey"),
            Environment.GetEnvironmentVariable("AI__LLM__APIKEY"),
            Environment.GetEnvironmentVariable("LLM_API_KEY"),
            Environment.GetEnvironmentVariable("AI_LLM_API_KEY"),
            Environment.GetEnvironmentVariable("RASS_API_KEY"),
            Environment.GetEnvironmentVariable("OPENAI_API_KEY"),
            Environment.GetEnvironmentVariable("GROQ_API_KEY"),
            LoadApiKeyFromDotEnv()
        };

        return candidates.FirstOrDefault(IsUsable)?.Trim();
    }

    private static string? LoadApiKeyFromDotEnv()
    {
        static string? Extract(string path)
        {
            if (!File.Exists(path)) return null;
            var acceptedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "AI__LLM__ApiKey",
                "AI_LLM_API_KEY",
                "LLM_API_KEY",
                "GROQ_API_KEY",
                "OPENAI_API_KEY",
                "RASS_API_KEY"
            };

            foreach (var raw in File.ReadLines(path))
            {
                var line = raw.Trim();
                if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#", StringComparison.Ordinal)) continue;
                var idx = line.IndexOf('=');
                if (idx <= 0) continue;

                var key = line[..idx].Trim();
                if (!acceptedKeys.Contains(key)) continue;

                var value = line[(idx + 1)..].Trim().Trim('"').Trim('\'');
                if (!string.IsNullOrWhiteSpace(value)) return value;
            }

            return null;
        }

        var cwd = Directory.GetCurrentDirectory();
        var candidates = new[]
        {
            Path.Combine(cwd, ".env"),
            Path.Combine(cwd, "backend", ".env"),
            Path.Combine(cwd, "..", ".env"),
            Path.Combine(cwd, "..", "frontend", ".env")
        };

        foreach (var candidate in candidates)
        {
            var value = Extract(candidate);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }

        return null;
    }
}
