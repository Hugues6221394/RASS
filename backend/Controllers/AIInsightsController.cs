using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Dtos;
using Rass.Api.Domain.Entities;
using Rass.Api.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Rass.Api.Controllers;

/// <summary>
/// AI-powered platform intelligence for admin monitoring and control
/// </summary>
[ApiController]
[Route("api/ai-insights")]
[Route("api/aiinsights")]
[Authorize(Roles = "Admin,Government")]
public class AIInsightsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AIInsightsService _aiService;
    private readonly AIChatService _aiChatService;
    private readonly ILogger<AIInsightsController> _logger;
    private readonly IConfiguration _configuration;

    public AIInsightsController(
        AppDbContext db,
        AIInsightsService aiService,
        AIChatService aiChatService,
        ILogger<AIInsightsController> logger,
        IConfiguration configuration)
    {
        _db = db;
        _aiService = aiService;
        _aiChatService = aiChatService;
        _logger = logger;
        _configuration = configuration;
    }

    #region Platform Alerts & Anomalies

    /// <summary>
    /// Run full platform anomaly scan and generate alerts
    /// </summary>
    [HttpPost("scan")]
    public async Task<IActionResult> RunAnomalyScan()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("Running platform anomaly scan triggered by user {UserId}", userId);

        var allAlerts = new List<PlatformAlert>();

        // Run all detection algorithms
        var priceAlerts = await _aiService.DetectPriceAnomaliesAsync();
        var suspiciousAlerts = await _aiService.DetectSuspiciousActivitiesAsync();
        var supplyDemandAlerts = await _aiService.DetectSupplyDemandImbalancesAsync();

        allAlerts.AddRange(priceAlerts);
        allAlerts.AddRange(suspiciousAlerts);
        allAlerts.AddRange(supplyDemandAlerts);

        // Save new alerts to database
        var existingAlertIds = await _db.PlatformAlerts
            .Where(a => a.Status == "Open" && a.CreatedAt >= DateTime.UtcNow.AddHours(-24))
            .Select(a => a.Title)
            .ToListAsync();

        var newAlerts = allAlerts.Where(a => !existingAlertIds.Contains(a.Title)).ToList();
        
        if (newAlerts.Any())
        {
            _db.PlatformAlerts.AddRange(newAlerts);
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            scannedAt = DateTime.UtcNow,
            totalAlertsGenerated = allAlerts.Count,
            newAlertsCreated = newAlerts.Count,
            alertsByType = allAlerts.GroupBy(a => a.AlertType).Select(g => new { type = g.Key, count = g.Count() }),
            alertsBySeverity = allAlerts.GroupBy(a => a.Severity).Select(g => new { severity = g.Key, count = g.Count() })
        });
    }

    /// <summary>
    /// Get all platform alerts with filtering
    /// </summary>
    [HttpGet("alerts")]
    public async Task<IActionResult> GetAlerts(
        [FromQuery] string? status = null,
        [FromQuery] string? severity = null,
        [FromQuery] string? type = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.PlatformAlerts.AsQueryable();

        if (!string.IsNullOrEmpty(status))
            query = query.Where(a => a.Status == status);
        if (!string.IsNullOrEmpty(severity))
            query = query.Where(a => a.Severity == severity);
        if (!string.IsNullOrEmpty(type))
            query = query.Where(a => a.AlertType == type);

        var total = await query.CountAsync();
        var alerts = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.AlertType,
                a.Severity,
                a.Title,
                a.Description,
                a.Crop,
                a.Region,
                a.ConfidenceScore,
                a.AiRecommendation,
                a.Status,
                a.CreatedAt,
                a.AcknowledgedAt
            })
            .ToListAsync();

        return Ok(new
        {
            alerts,
            pagination = new { page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) }
        });
    }

    /// <summary>
    /// Acknowledge an alert
    /// </summary>
    [HttpPost("alerts/{id}/acknowledge")]
    public async Task<IActionResult> AcknowledgeAlert(Guid id)
    {
        var alert = await _db.PlatformAlerts.FindAsync(id);
        if (alert == null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        
        alert.Status = "Acknowledged";
        alert.AcknowledgedBy = userId;
        alert.AcknowledgedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(alert);
    }

    /// <summary>
    /// Resolve an alert
    /// </summary>
    [HttpPost("alerts/{id}/resolve")]
    public async Task<IActionResult> ResolveAlert(Guid id, [FromBody] AlertResolutionDto? dto)
    {
        var alert = await _db.PlatformAlerts.FindAsync(id);
        if (alert == null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        alert.Status = "Resolved";
        alert.ResolvedBy = userId;
        alert.ResolvedAt = DateTime.UtcNow;
        alert.ResolutionNotes = dto?.Notes;

        await _db.SaveChangesAsync();
        return Ok(alert);
    }

    /// <summary>
    /// Get alert statistics summary
    /// </summary>
    [HttpGet("alerts/summary")]
    public async Task<IActionResult> GetAlertsSummary()
    {
        var stats = await _db.PlatformAlerts
            .Where(a => a.CreatedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(a => a.Status)
            .Select(g => new { status = g.Key, count = g.Count() })
            .ToListAsync();

        var bySeverity = await _db.PlatformAlerts
            .Where(a => a.Status == "Open")
            .GroupBy(a => a.Severity)
            .Select(g => new { severity = g.Key, count = g.Count() })
            .ToListAsync();

        var byType = await _db.PlatformAlerts
            .Where(a => a.CreatedAt >= DateTime.UtcNow.AddDays(-7))
            .GroupBy(a => a.AlertType)
            .Select(g => new { type = g.Key, count = g.Count() })
            .ToListAsync();

        return Ok(new
        {
            byStatus = stats,
            openBySeverity = bySeverity,
            recentByType = byType,
            criticalOpenCount = await _db.PlatformAlerts.CountAsync(a => a.Status == "Open" && a.Severity == "Critical")
        });
    }

    #endregion

    #region Data Quality

    /// <summary>
    /// Run data quality scan
    /// </summary>
    [HttpPost("data-quality/scan")]
    public async Task<IActionResult> RunDataQualityScan()
    {
        var issues = await _aiService.ScanDataQualityAsync();

        // Save new issues
        var existingIds = await _db.DataQualityIssues
            .Where(d => d.Status == "Open")
            .Select(d => d.EntityId)
            .ToListAsync();

        var newIssues = issues.Where(i => i.EntityId == null || !existingIds.Contains(i.EntityId)).ToList();

        if (newIssues.Any())
        {
            _db.DataQualityIssues.AddRange(newIssues);
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            scannedAt = DateTime.UtcNow,
            totalIssuesFound = issues.Count,
            newIssuesCreated = newIssues.Count,
            byType = issues.GroupBy(i => i.IssueType).Select(g => new { type = g.Key, count = g.Count() }),
            bySeverity = issues.GroupBy(i => i.Severity).Select(g => new { severity = g.Key, count = g.Count() })
        });
    }

    /// <summary>
    /// Get data quality issues
    /// </summary>
    [HttpGet("data-quality/issues")]
    public async Task<IActionResult> GetDataQualityIssues(
        [FromQuery] string? status = null,
        [FromQuery] string? severity = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.DataQualityIssues.AsQueryable();

        if (!string.IsNullOrEmpty(status))
            query = query.Where(i => i.Status == status);
        if (!string.IsNullOrEmpty(severity))
            query = query.Where(i => i.Severity == severity);

        var total = await query.CountAsync();
        var issues = await query
            .OrderByDescending(i => i.DetectedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { issues, pagination = new { page, pageSize, total } });
    }

    /// <summary>
    /// Backward-compatible endpoint returning only issue list
    /// </summary>
    [HttpGet("data-quality")]
    public async Task<IActionResult> GetDataQualityFlat([FromQuery] string status = "Open")
    {
        var issues = await _db.DataQualityIssues
            .Where(i => i.Status == status)
            .OrderByDescending(i => i.DetectedAt)
            .Take(200)
            .ToListAsync();

        return Ok(issues);
    }

    /// <summary>
    /// Mark data quality issue as corrected
    /// </summary>
    [HttpPost("data-quality/issues/{id}/correct")]
    public async Task<IActionResult> CorrectDataQualityIssue(Guid id, [FromBody] DataCorrectionDto dto)
    {
        var issue = await _db.DataQualityIssues.FindAsync(id);
        if (issue == null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        issue.Status = "ManuallyCorrected";
        issue.CorrectedBy = userId;
        issue.CorrectedAt = DateTime.UtcNow;
        issue.CorrectionNotes = dto.Notes;

        await _db.SaveChangesAsync();
        return Ok(issue);
    }

    #endregion

    #region Model Performance

    /// <summary>
    /// Get AI model performance summary
    /// </summary>
    [HttpGet("models/performance")]
    public async Task<IActionResult> GetModelPerformance()
    {
        var summary = await _aiService.GetModelPerformanceSummaryAsync();
        return Ok(summary);
    }

    /// <summary>
    /// Get detailed model performance logs
    /// </summary>
    [HttpGet("models/{modelName}/logs")]
    public async Task<IActionResult> GetModelLogs(string modelName, [FromQuery] int days = 30)
    {
        var logs = await _db.ModelPerformanceLogs
            .Where(l => l.ModelName == modelName && l.RecordedAt >= DateTime.UtcNow.AddDays(-days))
            .OrderByDescending(l => l.RecordedAt)
            .Take(100)
            .ToListAsync();

        return Ok(logs);
    }

    /// <summary>
    /// Log model performance (called by forecasting service)
    /// </summary>
    [HttpPost("models/log")]
    [AllowAnonymous] // Called by internal forecasting service
    public async Task<IActionResult> LogModelPerformance([FromBody] ModelPerformanceLog log, [FromHeader(Name = "X-Internal-Key")] string? internalKey)
    {
        var expectedInternalKey = _configuration["InternalService:AIInsightsKey"];
        if (string.IsNullOrWhiteSpace(expectedInternalKey) || internalKey != expectedInternalKey)
            return Unauthorized();

        await _aiService.LogModelPerformanceAsync(log);
        return Ok();
    }

    /// <summary>
    /// Start model training (national AI control)
    /// </summary>
    [HttpPost("models/train")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> StartModelTraining([FromBody] StartModelTrainingRequest request)
    {
        var modelType = request.ModelType?.Trim();
        var allowed = new[] { "ARIMA", "SARIMA", "Prophet", "LSTM", "XGBoost", "Ensemble" };
        if (string.IsNullOrWhiteSpace(modelType) || !allowed.Contains(modelType, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest("Unsupported model type.");
        }

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var now = DateTime.UtcNow;
        var datasetKey = await ResolveDatasetKey(request.DatasetKey, modelType);
        if (!string.IsNullOrWhiteSpace(request.DatasetKey) && string.IsNullOrWhiteSpace(datasetKey))
            return BadRequest("Dataset not found.");

        var task = new ScheduledTask
        {
            TaskName = $"Train {modelType} model",
            TaskType = "ModelRetraining",
            CronExpression = "manual",
            IsEnabled = true,
            LastRunAt = now,
            LastRunStatus = "Running",
            LastRunResult = $"Training triggered by admin for {modelType}",
            Parameters = JsonSerializer.Serialize(new
            {
                request.ModelType,
                request.Crop,
                request.Market,
                trainingDataDays = request.TrainingDataDays ?? 180,
                datasetKey
            }),
            CreatedBy = userId
        };
        _db.ScheduledTasks.Add(task);

        var cfgKey = $"AI:ModelTraining:{modelType}";
        var cfg = await _db.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == cfgKey);
        if (cfg == null)
        {
            cfg = new SystemConfiguration
            {
                Key = cfgKey,
                Value = "Running",
                ValueType = "String",
                Category = "AI",
                Description = $"Runtime status for {modelType} training",
                IsEditable = true,
                LastModifiedBy = userId,
                LastModifiedAt = now
            };
            _db.SystemConfigurations.Add(cfg);
        }
        else
        {
            cfg.Value = "Running";
            cfg.LastModifiedBy = userId;
            cfg.LastModifiedAt = now;
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            status = "TrainingStarted",
            modelType,
            datasetKey,
            startedAt = now,
            taskId = task.Id
        });
    }

    /// <summary>
    /// Backward-compatible training endpoint used by admin UI
    /// </summary>
    [HttpPost("train")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> StartTrainingCompat([FromBody] StartModelTrainingRequest request) => StartModelTraining(request);

    /// <summary>
    /// Stop model training
    /// </summary>
    [HttpPost("models/stop")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> StopModelTraining([FromBody] StopModelTrainingDto request)
    {
        if (string.IsNullOrWhiteSpace(request.ModelType))
            return BadRequest("ModelType is required.");

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var cfgKey = $"AI:ModelTraining:{request.ModelType}";
        var cfg = await _db.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == cfgKey);
        if (cfg == null)
        {
            cfg = new SystemConfiguration
            {
                Key = cfgKey,
                Value = "Stopped",
                ValueType = "String",
                Category = "AI",
                Description = $"Runtime status for {request.ModelType} training"
            };
            _db.SystemConfigurations.Add(cfg);
        }
        else
        {
            cfg.Value = "Stopped";
        }
        cfg.LastModifiedBy = userId;
        cfg.LastModifiedAt = DateTime.UtcNow;

        var runningTasks = await _db.ScheduledTasks
            .Where(t => t.TaskType == "ModelRetraining" && t.LastRunStatus == "Running" && t.TaskName.Contains(request.ModelType))
            .ToListAsync();
        foreach (var task in runningTasks)
        {
            task.LastRunStatus = "Stopped";
            task.LastRunResult = "Stopped by admin";
        }

        await _db.SaveChangesAsync();
        return Ok(new { status = "TrainingStopped", modelType = request.ModelType });
    }

    /// <summary>
    /// Schedule recurring model training jobs
    /// </summary>
    [HttpPost("models/schedule")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ScheduleModelTraining([FromBody] ScheduleModelTrainingDto request)
    {
        if (string.IsNullOrWhiteSpace(request.ModelType) || string.IsNullOrWhiteSpace(request.CronExpression))
            return BadRequest("ModelType and CronExpression are required.");

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var datasetKey = await ResolveDatasetKey(request.DatasetKey, request.ModelType);
        if (!string.IsNullOrWhiteSpace(request.DatasetKey) && string.IsNullOrWhiteSpace(datasetKey))
            return BadRequest("Dataset not found.");
        var task = new ScheduledTask
        {
            TaskName = $"Scheduled {request.ModelType} retraining",
            TaskType = "ModelRetraining",
            CronExpression = request.CronExpression,
            IsEnabled = true,
            LastRunStatus = "Scheduled",
            LastRunResult = "Waiting for scheduler",
            Parameters = JsonSerializer.Serialize(new
            {
                request.ModelType,
                request.Crop,
                request.Market,
                request.TrainingDataDays,
                datasetKey
            }),
            CreatedBy = userId
        };
        _db.ScheduledTasks.Add(task);
        await _db.SaveChangesAsync();

        return Ok(new { status = "Scheduled", taskId = task.Id, request.ModelType, request.CronExpression, datasetKey });
    }

    /// <summary>
    /// Configure model feature inputs
    /// </summary>
    [HttpPost("models/features")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ConfigureModelFeatures([FromBody] UpdateFeatureConfigRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ModelType) || request.Features == null || request.Features.Count == 0)
            return BadRequest("ModelType and at least one feature are required.");

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var key = $"AI:Features:{request.ModelType}";
        var config = await _db.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == key);
        var value = JsonSerializer.Serialize(request.Features);
        if (config == null)
        {
            config = new SystemConfiguration
            {
                Key = key,
                Value = value,
                ValueType = "Json",
                Category = "AI",
                Description = $"Feature list for {request.ModelType} model",
                IsEditable = true,
                LastModifiedBy = userId,
                LastModifiedAt = DateTime.UtcNow
            };
            _db.SystemConfigurations.Add(config);
        }
        else
        {
            config.Value = value;
            config.ValueType = "Json";
            config.LastModifiedBy = userId;
            config.LastModifiedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new { status = "Updated", request.ModelType, features = request.Features });
    }

    /// <summary>
    /// List supported models and their runtime status
    /// </summary>
    [HttpGet("models/catalog")]
    public async Task<IActionResult> GetModelsCatalog()
    {
        var models = new[] { "ARIMA", "SARIMA", "Prophet", "LSTM", "XGBoost", "Ensemble" };
        var latest = await _db.ModelPerformanceLogs
            .GroupBy(m => m.ModelName)
            .Select(g => g.OrderByDescending(x => x.RecordedAt).First())
            .ToListAsync();

        var statuses = await _db.SystemConfigurations
            .Where(c => c.Key.StartsWith("AI:ModelTraining:"))
            .ToListAsync();
        var modelDatasets = await _db.SystemConfigurations
            .Where(c => c.Key.StartsWith("AI:DatasetBinding:"))
            .ToListAsync();

        var catalog = models.Select(model =>
        {
            var perf = latest.FirstOrDefault(x => x.ModelName.Equals(model, StringComparison.OrdinalIgnoreCase));
            var run = statuses.FirstOrDefault(s => s.Key == $"AI:ModelTraining:{model}")?.Value ?? "Ready";
            var dataset = modelDatasets.FirstOrDefault(s => s.Key == $"AI:DatasetBinding:{model}")?.Value;
            return new
            {
                model,
                runtimeStatus = run,
                datasetKey = dataset,
                lastRecordedAt = perf?.RecordedAt,
                status = perf?.Status ?? "Unknown",
                mae = perf?.Mae,
                rmse = perf?.Rmse,
                accuracyRate = perf?.AccuracyRate,
                driftDetected = perf?.DriftDetected ?? false
            };
        });

        return Ok(catalog);
    }

    [HttpGet("datasets")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetDatasets()
    {
        var datasets = await GetDatasetRegistry();
        var active = await _db.SystemConfigurations
            .Where(c => c.Key == "AI:Datasets:Active")
            .Select(c => c.Value)
            .FirstOrDefaultAsync();
        var bindings = await _db.SystemConfigurations
            .Where(c => c.Key.StartsWith("AI:DatasetBinding:"))
            .ToListAsync();

        return Ok(new
        {
            activeDatasetKey = active,
            items = datasets.Select(d => new
            {
                d.key,
                d.name,
                d.source,
                d.description,
                d.createdAt,
                isActive = !string.IsNullOrWhiteSpace(active) && string.Equals(d.key, active, StringComparison.OrdinalIgnoreCase),
                boundModels = bindings
                    .Where(b => string.Equals(b.Value, d.key, StringComparison.OrdinalIgnoreCase))
                    .Select(b => b.Key.Replace("AI:DatasetBinding:", ""))
                    .ToList()
            })
        });
    }

    [HttpPost("datasets/register")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RegisterDataset([FromBody] RegisterDatasetRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var key = request.Key.Trim();
        if (string.IsNullOrWhiteSpace(key)) return BadRequest("Dataset key is required.");

        var datasets = await GetDatasetRegistry();
        if (datasets.Any(d => d.key.Equals(key, StringComparison.OrdinalIgnoreCase)))
            return BadRequest("Dataset key already exists.");

        datasets.Add(new DatasetRegistryItem(
            key: key,
            name: request.Name.Trim(),
            source: request.Source?.Trim(),
            description: request.Description?.Trim(),
            createdAt: DateTime.UtcNow));
        await SaveDatasetRegistry(datasets, userId);

        return Ok(new { status = "Registered", datasetKey = key });
    }

    [HttpPost("datasets/active")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetActiveDataset([FromBody] SetActiveDatasetRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var datasets = await GetDatasetRegistry();
        if (!datasets.Any(d => d.key.Equals(request.DatasetKey, StringComparison.OrdinalIgnoreCase)))
            return BadRequest("Dataset not found.");

        await UpsertConfig("AI:Datasets:Active", request.DatasetKey.Trim(), "String", "AI", "Active dataset for model training", userId);
        await _db.SaveChangesAsync();

        return Ok(new { status = "ActiveSet", datasetKey = request.DatasetKey.Trim() });
    }

    [HttpPost("models/dataset")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BindDatasetToModel([FromBody] BindModelDatasetRequest request)
    {
        var modelType = request.ModelType?.Trim();
        var allowed = new[] { "ARIMA", "SARIMA", "Prophet", "LSTM", "XGBoost", "Ensemble" };
        if (string.IsNullOrWhiteSpace(modelType) || !allowed.Contains(modelType, StringComparer.OrdinalIgnoreCase))
            return BadRequest("Unsupported model type.");

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var datasets = await GetDatasetRegistry();
        if (!datasets.Any(d => d.key.Equals(request.DatasetKey, StringComparison.OrdinalIgnoreCase)))
            return BadRequest("Dataset not found.");

        await UpsertConfig($"AI:DatasetBinding:{modelType}", request.DatasetKey.Trim(), "String", "AI", $"Dataset bound to {modelType}", userId);
        await _db.SaveChangesAsync();

        return Ok(new { status = "Bound", modelType, datasetKey = request.DatasetKey.Trim() });
    }

    #endregion

    #region Recommendations & Intelligence

    /// <summary>
    /// Get AI-generated recommendations for admin
    /// </summary>
    [HttpGet("recommendations")]
    public async Task<IActionResult> GetRecommendations()
    {
        var recommendations = await _aiService.GenerateAdminRecommendationsAsync();
        return Ok(recommendations);
    }

    /// <summary>
    /// Executive-level comprehensive AI dashboard payload for Admin/Government.
    /// </summary>
    [HttpGet("executive-dashboard")]
    public async Task<IActionResult> GetExecutiveDashboard()
    {
        var now = DateTime.UtcNow;
        var from30 = now.AddDays(-30);
        var from7 = now.AddDays(-7);

        var openAlerts = await _db.PlatformAlerts.CountAsync(a => a.Status == "Open");
        var criticalAlerts = await _db.PlatformAlerts.CountAsync(a => a.Status == "Open" && a.Severity == "Critical");
        var newAlerts7d = await _db.PlatformAlerts.CountAsync(a => a.CreatedAt >= from7);
        var resolvedAlerts7d = await _db.PlatformAlerts.CountAsync(a => a.Status == "Resolved" && a.ResolvedAt >= from7);

        var dataQualityOpen = await _db.DataQualityIssues.CountAsync(i => i.Status == "Open");
        var highQualityOpen = await _db.DataQualityIssues.CountAsync(i => i.Status == "Open" && (i.Severity == "High" || i.Severity == "Critical"));

        var activeUsers24h = await _db.Users.CountAsync(u => u.LastLogin != null && u.LastLogin >= now.AddHours(-24));
        var inactiveUsers14d = await _db.Users.CountAsync(u => u.LastLogin == null || u.LastLogin < now.AddDays(-14));
        var pendingContracts = await _db.Contracts.CountAsync(c => c.Status == "PendingApproval" || c.Status == "PendingSignature");
        var disputedContracts = await _db.Contracts.CountAsync(c => c.Status == "Disputed");
        var escrowPending = await _db.Contracts.CountAsync(c => c.EscrowStatus == "Funded" && c.Status != "Completed");

        var modelHealth = await _db.ModelPerformanceLogs
            .Where(l => l.RecordedAt >= from30)
            .GroupBy(l => l.ModelName)
            .Select(g => g.OrderByDescending(x => x.RecordedAt).First())
            .Select(l => new
            {
                model = l.ModelName,
                status = l.Status,
                accuracyRate = Math.Round(l.AccuracyRate, 2),
                mae = l.Mae,
                rmse = l.Rmse,
                mape = l.Mape,
                driftDetected = l.DriftDetected,
                recordedAt = l.RecordedAt
            })
            .ToListAsync();

        var logistics = await _db.TransportRequests
            .Where(t => t.CreatedAt >= from30)
            .GroupBy(t => t.Status)
            .Select(g => new
            {
                status = g.Key,
                count = g.Count(),
                avgLoadKg = Math.Round(g.Average(x => x.LoadKg), 2),
                avgValue = Math.Round(g.Average(x => x.Price), 2)
            })
            .OrderByDescending(x => x.count)
            .ToListAsync();

        var supply = await _db.MarketListings
            .Where(l => l.CreatedAt >= from30)
            .GroupBy(l => l.Crop)
            .Select(g => new { crop = g.Key, supplyKg = g.Sum(x => x.QuantityKg) })
            .ToListAsync();
        var demand = await _db.BuyerOrders
            .Where(o => o.CreatedAt >= from30)
            .GroupBy(o => o.Crop)
            .Select(g => new { crop = g.Key, demandKg = g.Sum(x => x.QuantityKg) })
            .ToListAsync();
        var demandMap = demand.ToDictionary(x => x.crop, x => x.demandKg, StringComparer.OrdinalIgnoreCase);
        var balance = supply
            .Select(x =>
            {
                var d = demandMap.TryGetValue(x.crop, out var v) ? v : 0;
                return new
                {
                    crop = x.crop,
                    supplyKg = Math.Round(x.supplyKg, 2),
                    demandKg = Math.Round(d, 2),
                    balanceKg = Math.Round(x.supplyKg - d, 2)
                };
            })
            .OrderByDescending(x => Math.Abs(x.balanceKg))
            .Take(12)
            .ToList();

        var volatility = await _db.MarketPrices
            .Where(p => p.ObservedAt >= from30)
            .GroupBy(p => p.Crop)
            .Select(g => new
            {
                crop = g.Key,
                min = g.Min(x => x.PricePerKg),
                max = g.Max(x => x.PricePerKg),
                avg = g.Average(x => x.PricePerKg),
                spread = Math.Round(g.Max(x => x.PricePerKg) - g.Min(x => x.PricePerKg), 2)
            })
            .OrderByDescending(x => x.spread)
            .Take(10)
            .ToListAsync();

        var recommendations = await _aiService.GenerateAdminRecommendationsAsync();

        return Ok(new
        {
            generatedAt = now,
            executiveKpis = new
            {
                openAlerts,
                criticalAlerts,
                newAlerts7d,
                resolvedAlerts7d,
                dataQualityOpen,
                highQualityOpen,
                activeUsers24h,
                inactiveUsers14d,
                pendingContracts,
                disputedContracts,
                escrowPending
            },
            modelHealth,
            logistics,
            cropSupplyDemandBalance = balance,
            priceVolatility = volatility,
            recommendations
        });
    }

    /// <summary>
    /// Admin AI assistant grounded in current executive dashboard signals.
    /// </summary>
    [HttpPost("assistant")]
    [Authorize(Roles = "Admin,Government")]
    public async Task<IActionResult> AskAssistant([FromBody] AdminAssistantRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Question))
            return BadRequest("Question is required.");

        var snapshotResult = await GetExecutiveDashboard() as OkObjectResult;
        if (snapshotResult?.Value == null)
            return StatusCode(500, "Unable to generate assistant context.");

        var node = JsonSerializer.SerializeToElement(snapshotResult.Value);
        var kpi = node.TryGetProperty("executiveKpis", out var k) ? k : default;
        var openAlerts = kpi.ValueKind == JsonValueKind.Object && kpi.TryGetProperty("openAlerts", out var oa) ? oa.GetInt32() : 0;
        var criticalAlerts = kpi.ValueKind == JsonValueKind.Object && kpi.TryGetProperty("criticalAlerts", out var ca) ? ca.GetInt32() : 0;
        var pendingContracts = kpi.ValueKind == JsonValueKind.Object && kpi.TryGetProperty("pendingContracts", out var pc) ? pc.GetInt32() : 0;
        var qualityOpen = kpi.ValueKind == JsonValueKind.Object && kpi.TryGetProperty("dataQualityOpen", out var dq) ? dq.GetInt32() : 0;
        var inactiveUsers = kpi.ValueKind == JsonValueKind.Object && kpi.TryGetProperty("inactiveUsers14d", out var iu) ? iu.GetInt32() : 0;

        var recs = node.TryGetProperty("recommendations", out var recNode) && recNode.ValueKind == JsonValueKind.Array
            ? recNode.EnumerateArray().Take(4)
                .Select(r => r.TryGetProperty("title", out var t) ? t.GetString() ?? string.Empty : string.Empty)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToArray()
            : Array.Empty<string>();

        var context = JsonSerializer.Serialize(new
        {
            role = "Admin",
            openAlerts,
            criticalAlerts,
            pendingContracts,
            dataQualityOpen = qualityOpen,
            inactiveUsers14d = inactiveUsers,
            recommendations = recs
        });
        string answer;
        try
        {
            answer = await _aiChatService.ProcessRoleQueryAsync(request.Question.Trim(), "Admin", context);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        return Ok(new
        {
            question = request.Question.Trim(),
            answer,
            context = new
            {
                openAlerts,
                criticalAlerts,
                pendingContracts,
                dataQualityOpen = qualityOpen,
                inactiveUsers14d = inactiveUsers
            },
            recommendations = recs,
            generatedAt = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Get comprehensive national statistics
    /// </summary>
    [HttpGet("national-stats")]
    public async Task<IActionResult> GetNationalStatistics()
    {
        var stats = await _aiService.GetNationalStatisticsAsync();
        return Ok(stats);
    }

    /// <summary>
    /// Get platform health dashboard data
    /// </summary>
    [HttpGet("health")]
    public async Task<IActionResult> GetPlatformHealth()
    {
        var openAlerts = await _db.PlatformAlerts.CountAsync(a => a.Status == "Open");
        var criticalAlerts = await _db.PlatformAlerts.CountAsync(a => a.Status == "Open" && a.Severity == "Critical");
        var dataQualityIssues = await _db.DataQualityIssues.CountAsync(i => i.Status == "Open");

        var modelHealth = await _db.ModelPerformanceLogs
            .Where(l => l.RecordedAt >= DateTime.UtcNow.AddDays(-1))
            .GroupBy(l => l.ModelName)
            .Select(g => g.OrderByDescending(l => l.RecordedAt).Select(l => new
            {
                model = g.Key,
                status = l.Status,
                mae = l.Mae,
                rmse = l.Rmse,
                accuracyRate = l.AccuracyRate,
                driftDetected = l.DriftDetected,
                confidenceLevel = l.ConfidenceLevel,
                recordedAt = l.RecordedAt
            }).First())
            .ToListAsync();

        var activeUsers24h = await _db.Users
            .CountAsync(u => u.LastLogin != null && u.LastLogin >= DateTime.UtcNow.AddHours(-24));

        var activeDeliveries = await _db.TransportRequests
            .CountAsync(t => new[] { "Assigned", "Accepted", "PickedUp", "InTransit" }.Contains(t.Status));
        var completedToday = await _db.TransportRequests
            .CountAsync(t => (t.Status == "Delivered" || t.Status == "Completed") && t.DeliveredAt >= DateTime.UtcNow.Date);
        var delayedDeliveries = await _db.DeliveryTrackingInfos
            .CountAsync(t => t.IsDelayed);

        var pendingOrders = await _db.BuyerOrders
            .CountAsync(o => o.Status == "Open" || o.Status == "Accepted");

        return Ok(new
        {
            overall = openAlerts == 0 && criticalAlerts == 0 && dataQualityIssues < 5 ? "Healthy" : 
                     criticalAlerts > 0 ? "Critical" : "Warning",
            alerts = new { open = openAlerts, critical = criticalAlerts },
            dataQuality = new { openIssues = dataQualityIssues },
            modelHealth,
            models = modelHealth,
            activity = new
            {
                activeUsers24h,
                activeDeliveries,
                completedToday,
                delayedDeliveries,
                pendingOrders
            },
            activeUsers24h,
            activeDeliveries,
            completedToday,
            delayedDeliveries,
            pendingOrders,
            generatedAt = DateTime.UtcNow
        });
    }

    /// <summary>
    /// National logistics monitoring overview with live delivery details
    /// </summary>
    [HttpGet("logistics/overview")]
    public async Task<IActionResult> GetLogisticsOverview()
    {
        var activeStatuses = new[] { "Assigned", "Accepted", "PickedUp", "InTransit" };

        var activeDeliveries = await _db.TransportRequests
            .Where(t => activeStatuses.Contains(t.Status))
            .Include(t => t.Transporter)
            .Include(t => t.Contract)
                .ThenInclude(c => c!.BuyerOrder)
            .OrderByDescending(t => t.AssignedAt ?? t.CreatedAt)
            .Take(200)
            .Select(t => new
            {
                t.Id,
                t.Status,
                t.Origin,
                t.Destination,
                t.LoadKg,
                t.Price,
                t.PickupStart,
                t.PickupEnd,
                t.DriverPhone,
                transporter = t.Transporter != null ? new
                {
                    t.Transporter.Id,
                    t.Transporter.CompanyName,
                    t.Transporter.VehicleType,
                    t.Transporter.LicensePlate
                } : null,
                contract = t.Contract != null ? new
                {
                    t.Contract.Id,
                    t.Contract.TrackingId,
                    crop = t.Contract.BuyerOrder != null ? t.Contract.BuyerOrder.Crop : null
                } : null
            })
            .ToListAsync();

        var trackingMap = await _db.DeliveryTrackingInfos
            .Where(d => activeDeliveries.Select(a => a.Id).Contains(d.TransportRequestId))
            .Select(d => new
            {
                d.TransportRequestId,
                d.CurrentLatitude,
                d.CurrentLongitude,
                d.ProgressPercent,
                d.CurrentEta,
                d.IsDelayed,
                d.DelayMinutes,
                d.TrackingStatus,
                d.LastLocationUpdate
            })
            .ToListAsync();

        var delayedCount = trackingMap.Count(t => t.IsDelayed);
        var deliveredToday = await _db.TransportRequests
            .CountAsync(t => (t.Status == "Delivered" || t.Status == "Completed") && t.DeliveredAt >= DateTime.UtcNow.Date);

        return Ok(new
        {
            summary = new
            {
                activeDeliveries = activeDeliveries.Count,
                delayedDeliveries = delayedCount,
                completedToday = deliveredToday
            },
            deliveries = activeDeliveries.Select(d =>
            {
                var tracking = trackingMap.FirstOrDefault(t => t.TransportRequestId == d.Id);
                return new
                {
                    d.Id,
                    d.Status,
                    d.Origin,
                    d.Destination,
                    d.LoadKg,
                    d.Price,
                    d.PickupStart,
                    d.PickupEnd,
                    d.DriverPhone,
                    d.transporter,
                    d.contract,
                    tracking
                };
            }),
            generatedAt = DateTime.UtcNow
        });
    }

    #endregion

    #region System Configuration

    /// <summary>
    /// Get all system configurations
    /// </summary>
    [HttpGet("config")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetConfigurations([FromQuery] string? category = null)
    {
        var query = _db.SystemConfigurations.AsQueryable();

        if (!string.IsNullOrEmpty(category))
            query = query.Where(c => c.Category == category);

        var configs = await query.OrderBy(c => c.Category).ThenBy(c => c.Key).ToListAsync();
        return Ok(configs);
    }

    /// <summary>
    /// Update a system configuration
    /// </summary>
    [HttpPut("config/{key}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateConfiguration(string key, [FromBody] ConfigUpdateDto dto)
    {
        var config = await _db.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == key);
        if (config == null) return NotFound();

        if (!config.IsEditable) return BadRequest("This configuration is not editable");

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        config.Value = dto.Value;
        config.LastModifiedBy = userId;
        config.LastModifiedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Configuration {Key} updated by user {UserId}", key, userId);
        return Ok(config);
    }

    /// <summary>
    /// Create a new system configuration
    /// </summary>
    [HttpPost("config")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateConfiguration([FromBody] SystemConfiguration config)
    {
        var existing = await _db.SystemConfigurations.AnyAsync(c => c.Key == config.Key);
        if (existing) return BadRequest("Configuration with this key already exists");

        _db.SystemConfigurations.Add(config);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetConfigurations), new { key = config.Key }, config);
    }

    #endregion

    #region Scheduled Tasks

    /// <summary>
    /// Get all scheduled tasks
    /// </summary>
    [HttpGet("tasks")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetScheduledTasks()
    {
        var tasks = await _db.ScheduledTasks.OrderBy(t => t.TaskName).ToListAsync();
        return Ok(tasks);
    }

    /// <summary>
    /// Enable/disable a scheduled task
    /// </summary>
    [HttpPost("tasks/{id}/toggle")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleTask(Guid id)
    {
        var task = await _db.ScheduledTasks.FindAsync(id);
        if (task == null) return NotFound();

        task.IsEnabled = !task.IsEnabled;
        await _db.SaveChangesAsync();

        return Ok(task);
    }

    /// <summary>
    /// Run a scheduled task immediately
    /// </summary>
    [HttpPost("tasks/{id}/run")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RunTaskNow(Guid id)
    {
        var task = await _db.ScheduledTasks.FindAsync(id);
        if (task == null) return NotFound();

        // In a real implementation, this would trigger the actual task
        // For now, we'll just update the last run time
        task.LastRunAt = DateTime.UtcNow;
        task.LastRunStatus = "Success";
        task.LastRunResult = "Manual execution triggered";

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Task '{task.TaskName}' execution triggered", task });
    }

    #endregion

    private async Task<string?> ResolveDatasetKey(string? requestedDatasetKey, string modelType)
    {
        var datasets = await GetDatasetRegistry();
        if (!string.IsNullOrWhiteSpace(requestedDatasetKey))
        {
            if (!datasets.Any(d => d.key.Equals(requestedDatasetKey.Trim(), StringComparison.OrdinalIgnoreCase)))
                return null;
            return requestedDatasetKey.Trim();
        }

        var modelBinding = await _db.SystemConfigurations
            .Where(c => c.Key == $"AI:DatasetBinding:{modelType}")
            .Select(c => c.Value)
            .FirstOrDefaultAsync();
        if (!string.IsNullOrWhiteSpace(modelBinding)) return modelBinding;

        var active = await _db.SystemConfigurations
            .Where(c => c.Key == "AI:Datasets:Active")
            .Select(c => c.Value)
            .FirstOrDefaultAsync();
        return string.IsNullOrWhiteSpace(active) ? null : active;
    }

    private async Task<List<DatasetRegistryItem>> GetDatasetRegistry()
    {
        var raw = await _db.SystemConfigurations
            .Where(c => c.Key == "AI:Datasets:Registry")
            .Select(c => c.Value)
            .FirstOrDefaultAsync();
        if (string.IsNullOrWhiteSpace(raw)) return new List<DatasetRegistryItem>();

        try
        {
            return JsonSerializer.Deserialize<List<DatasetRegistryItem>>(raw) ?? new List<DatasetRegistryItem>();
        }
        catch
        {
            return new List<DatasetRegistryItem>();
        }
    }

    private async Task SaveDatasetRegistry(List<DatasetRegistryItem> datasets, Guid userId)
    {
        var value = JsonSerializer.Serialize(datasets);
        await UpsertConfig("AI:Datasets:Registry", value, "Json", "AI", "Registered training datasets", userId);
        await _db.SaveChangesAsync();
    }

    private async Task UpsertConfig(string key, string value, string valueType, string category, string description, Guid userId)
    {
        var cfg = await _db.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == key);
        if (cfg == null)
        {
            cfg = new SystemConfiguration
            {
                Key = key,
                Value = value,
                ValueType = valueType,
                Category = category,
                Description = description,
                IsEditable = true,
                LastModifiedBy = userId,
                LastModifiedAt = DateTime.UtcNow
            };
            _db.SystemConfigurations.Add(cfg);
        }
        else
        {
            cfg.Value = value;
            cfg.ValueType = valueType;
            cfg.Category = category;
            cfg.Description = description;
            cfg.LastModifiedBy = userId;
            cfg.LastModifiedAt = DateTime.UtcNow;
        }
    }
}

#region DTOs

public record DatasetRegistryItem(
    string key,
    string name,
    string? source,
    string? description,
    DateTime createdAt);

public class AlertResolutionDto
{
    public string? Notes { get; set; }
}

public class DataCorrectionDto
{
    public string? Notes { get; set; }
}

public class ConfigUpdateDto
{
    public string Value { get; set; } = string.Empty;
}

public class StopModelTrainingDto
{
    public string ModelType { get; set; } = string.Empty;
}

public class ScheduleModelTrainingDto
{
    public string ModelType { get; set; } = string.Empty;
    public string CronExpression { get; set; } = string.Empty;
    public string? Crop { get; set; }
    public string? Market { get; set; }
    public int? TrainingDataDays { get; set; }
    public string? DatasetKey { get; set; }
}

public class AdminAssistantRequest
{
    public string Question { get; set; } = string.Empty;
}

#endregion
