using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.RateLimiting;
using Rass.Api.Data;
using Rass.Api.Services;
using Rass.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
        .ConfigureWarnings(warnings => warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

builder.Services.AddScoped<TokenService>();
builder.Services.AddHttpClient<ForecastingService>();
builder.Services.AddHttpClient<MtnMomoService>();
builder.Services.AddScoped<ForecastingService>();
builder.Services.AddScoped<MtnMomoService>();
builder.Services.AddSingleton<ILocalizationService, LocalizationService>();
builder.Services.AddScoped<ISmsService, SmsService>();
builder.Services.AddScoped<CatalogManagementService>();

// AI Insights Service for admin intelligence
builder.Services.AddScoped<AIInsightsService>();
builder.Services.AddScoped<AIChatService>();
builder.Services.AddHostedService<AIInsightsWorker>();

// SignalR for real-time notifications, chat, and GPS tracking
builder.Services.AddSignalR();
builder.Services.AddSingleton<Microsoft.AspNetCore.SignalR.IUserIdProvider, JwtUserIdProvider>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowDev", policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .WithExposedHeaders("X-Action-Message")
            .AllowCredentials());
});

var jwtSettings = builder.Configuration.GetSection("Jwt");
var signingKey = jwtSettings.GetValue<string>("SigningKey") ?? throw new InvalidOperationException("JWT signing key missing");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.GetValue<string>("Issuer"),
        ValidAudience = jwtSettings.GetValue<string>("Audience"),
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey))
    };
    
    // Allow SignalR to use JWT from query string
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ForecastViewer", policy =>
        policy.RequireRole("Farmer", "Buyer", "CooperativeManager", "MarketAgent", "Government", "Admin"));
    options.AddPolicy("MarketMonitoring", policy =>
        policy.RequireRole("MarketAgent", "Admin"));
    options.AddPolicy("GovAnalytics", policy =>
        policy.RequireRole("Government", "Admin"));
    options.AddPolicy("ForecastAdmin", policy =>
        policy.RequireRole("Admin"));
    options.AddPolicy("AIInsights", policy =>
        policy.RequireRole("Admin", "Government"));
});

// Rate Limiting to prevent API abuse
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter(policyName: "fixed", options =>
    {
        options.PermitLimit = 100;
        options.Window = TimeSpan.FromMinutes(1);
        options.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        options.QueueLimit = 2;
    });
    options.AddFixedWindowLimiter(policyName: "public-forecast", options =>
    {
        options.PermitLimit = 20;
        options.Window = TimeSpan.FromMinutes(1);
        options.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        options.QueueLimit = 2;
    });
    options.AddFixedWindowLimiter(policyName: "auth-forecast", options =>
    {
        options.PermitLimit = 120;
        options.Window = TimeSpan.FromMinutes(1);
        options.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        options.QueueLimit = 10;
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    SeedData.Apply(db);
    await CatalogSeed.ApplyAsync(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowDev");

app.UseRateLimiter(); // Apply rate limiting middleware

app.UseAuthentication();

app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var maintenanceBypass = path.StartsWith("/api/auth/login", StringComparison.OrdinalIgnoreCase)
                            || path.StartsWith("/api/auth/forgot-password", StringComparison.OrdinalIgnoreCase)
                            || path.StartsWith("/api/auth/reset-password", StringComparison.OrdinalIgnoreCase);

    if (!maintenanceBypass && context.User?.Identity?.IsAuthenticated == true && !context.User.IsInRole("Admin"))
    {
        var db = context.RequestServices.GetRequiredService<AppDbContext>();
        var maintenanceEnabledValue = await db.SystemConfigurations
            .Where(c => c.Key == "system.maintenance.enabled")
            .Select(c => c.Value)
            .FirstOrDefaultAsync();

        if (bool.TryParse(maintenanceEnabledValue, out var maintenanceEnabled) && maintenanceEnabled)
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"message\":\"System is under maintenance. Please try again later.\"}");
            return;
        }
    }

    await next();
});

app.Use(async (context, next) =>
{
    static string HumanizeSegment(string segment)
    {
        if (string.IsNullOrWhiteSpace(segment)) return string.Empty;
        var chars = new List<char>(segment.Length + 6);
        for (var i = 0; i < segment.Length; i++)
        {
            var c = segment[i];
            if (i > 0 && char.IsUpper(c) && char.IsLower(segment[i - 1])) chars.Add(' ');
            chars.Add(c == '-' || c == '_' ? ' ' : char.ToLowerInvariant(c));
        }
        return string.Join(' ', new string(chars.ToArray()).Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    static string BuildActionMessage(string method, string path, int statusCode)
    {
        var segments = (path ?? string.Empty)
            .Trim('/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Where(s => !s.Equals("api", StringComparison.OrdinalIgnoreCase))
            .Where(s => !Guid.TryParse(s, out _))
            .Select(HumanizeSegment)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();
        var target = segments.Count > 0 ? string.Join(' ', segments) : "action";
        var successVerb = method switch
        {
            "POST" => "created",
            "PUT" => "updated",
            "PATCH" => "updated",
            "DELETE" => "deleted",
            _ => "completed"
        };
        var failureVerb = method switch
        {
            "POST" => "create",
            "PUT" => "update",
            "PATCH" => "update",
            "DELETE" => "delete",
            _ => "complete"
        };

        if (statusCode >= 400) return $"Failed to {failureVerb} {target} ({statusCode}).";
        return $"Successfully {successVerb} {target}.";
    }

    var path = context.Request.Path.Value ?? string.Empty;
    var method = context.Request.Method.ToUpperInvariant();
    var noisyActionMessagePath = path.StartsWith("/api/auth/", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/chat/", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/aichat", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/aiinsights/", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/role-analytics/", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/forecast", StringComparison.OrdinalIgnoreCase);
    if (!noisyActionMessagePath
        && path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
        && (method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE"))
    {
        context.Response.OnStarting(() =>
        {
            if (!context.Response.Headers.ContainsKey("X-Action-Message"))
            {
                context.Response.Headers.Append("X-Action-Message", BuildActionMessage(method, path, context.Response.StatusCode));
            }
            return Task.CompletedTask;
        });
    }

    var started = DateTime.UtcNow;
    await next();

    if (!path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)) return;
    if (path.StartsWith("/api/admin/audit-logs", StringComparison.OrdinalIgnoreCase)) return;
    if (path.StartsWith("/api/admin/system-health", StringComparison.OrdinalIgnoreCase)) return;
    if (path.StartsWith("/api/notifications", StringComparison.OrdinalIgnoreCase)) return;

    try
    {
        var db = context.RequestServices.GetRequiredService<AppDbContext>();
        var requestMethod = context.Request.Method;
        var statusCode = context.Response.StatusCode;
        var userId = context.User?.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value
                     ?? context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                     ?? "Anonymous";
        var actorName = context.User?.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                        ?? context.User?.FindFirst("name")?.Value
                        ?? userId;
        var roles = context.User?.Claims
            .Where(c => c.Type == System.Security.Claims.ClaimTypes.Role)
            .Select(c => c.Value)
            .ToArray() ?? Array.Empty<string>();

        var durationMs = (DateTime.UtcNow - started).TotalMilliseconds;
        var actorRole = roles.FirstOrDefault() ?? "Anonymous";
        var actionType = requestMethod.Equals("POST", StringComparison.OrdinalIgnoreCase) ? "CREATE"
            : requestMethod.Equals("PUT", StringComparison.OrdinalIgnoreCase) || requestMethod.Equals("PATCH", StringComparison.OrdinalIgnoreCase) ? "UPDATE"
            : requestMethod.Equals("DELETE", StringComparison.OrdinalIgnoreCase) ? "DELETE"
            : requestMethod.Equals("GET", StringComparison.OrdinalIgnoreCase) ? "READ"
            : requestMethod.ToUpperInvariant();
        var ipAddr = context.Connection.RemoteIpAddress?.ToString();
        var deviceStr = context.Request.Headers.UserAgent.ToString();
        db.AuditLogs.Add(new Rass.Api.Domain.Entities.AuditLog
        {
            Id = Guid.NewGuid(),
            Action = $"API_{requestMethod}_{statusCode}",
            Actor = userId,
            ActorRole = actorRole,
            ActionType = actionType,
            EntityType = "ApiRequest",
            EntityId = path,
            IpAddress = ipAddr,
            DeviceInfo = deviceStr?.Length > 500 ? deviceStr[..500] : deviceStr,
            StatusCode = statusCode,
            DurationMs = durationMs,
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                actor_id = userId,
                actor_name = actorName,
                actor_role = actorRole,
                action_type = actionType,
                entity_type = "ApiRequest",
                entity_id = path,
                ip_address = ipAddr,
                device_info = deviceStr,
                method = requestMethod,
                path,
                query = context.Request.QueryString.Value,
                statusCode,
                durationMs,
                roles,
                timestamp = DateTime.UtcNow
            }),
            Timestamp = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }
    catch
    {
        // Ignore audit logging failures to avoid impacting request flow.
    }
});

app.UseAuthorization();

var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
if (!Directory.Exists(uploadsPath)) Directory.CreateDirectory(uploadsPath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

app.MapControllers();

// Map SignalR Hubs
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<TrackingHub>("/hubs/tracking"); // GPS tracking hub

app.Run();
