using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

/// <summary>
/// AI-detected platform anomalies and alerts for admin review
/// </summary>
public class PlatformAlert
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(50)]
    public string AlertType { get; set; } = string.Empty; // PriceSpike, PriceDrop, SuspiciousActivity, FraudRisk, DataQuality, ModelDrift, SupplyShortage, DemandSurge, InactiveUser

    [MaxLength(20)]
    public string Severity { get; set; } = "Medium"; // Critical, High, Medium, Low, Info

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;

    // === Context ===
    [MaxLength(100)]
    public string? Crop { get; set; }

    [MaxLength(100)]
    public string? Region { get; set; }

    [MaxLength(100)]
    public string? District { get; set; }

    public Guid? RelatedUserId { get; set; }
    public User? RelatedUser { get; set; }

    public Guid? RelatedEntityId { get; set; }

    [MaxLength(50)]
    public string? RelatedEntityType { get; set; } // Contract, Order, Listing, TransportRequest, etc.

    // === AI Analysis ===
    public double ConfidenceScore { get; set; } // 0-1

    [MaxLength(2000)]
    public string? AiRecommendation { get; set; }

    [MaxLength(1000)]
    public string? SupportingData { get; set; } // JSON with additional metrics

    // === Status ===
    [MaxLength(30)]
    public string Status { get; set; } = "Open"; // Open, Acknowledged, Investigating, Resolved, Dismissed

    public Guid? AcknowledgedBy { get; set; }
    public DateTime? AcknowledgedAt { get; set; }

    public Guid? ResolvedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }

    [MaxLength(500)]
    public string? ResolutionNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
}

/// <summary>
/// AI Model performance tracking for admin monitoring
/// </summary>
public class ModelPerformanceLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(50)]
    public string ModelName { get; set; } = string.Empty; // Prophet, SARIMA, LSTM, GBR, Ensemble

    [MaxLength(50)]
    public string ModelType { get; set; } = string.Empty; // PriceForecast, SupplyForecast, DemandForecast, AnomalyDetection

    [MaxLength(100)]
    public string? Crop { get; set; }

    [MaxLength(100)]
    public string? Market { get; set; }

    // === Performance Metrics ===
    public double? Mae { get; set; } // Mean Absolute Error
    public double? Rmse { get; set; } // Root Mean Square Error
    public double? Mape { get; set; } // Mean Absolute Percentage Error
    public double? R2Score { get; set; } // R-squared

    public double? ConfidenceLevel { get; set; }

    // === Predictions vs Actuals ===
    public int TotalPredictions { get; set; }
    public int AccuratePredictions { get; set; } // Within acceptable range
    public double AccuracyRate { get; set; } // 0-100

    // === Drift Detection ===
    public bool DriftDetected { get; set; }
    public double? DriftScore { get; set; }

    [MaxLength(500)]
    public string? DriftReason { get; set; }

    // === Training Info ===
    public DateTime? LastTrainedAt { get; set; }
    public int TrainingDataPoints { get; set; }
    public double? TrainingDurationSeconds { get; set; }

    [MaxLength(40)]
    public string Status { get; set; } = "Active"; // Active, Degraded, NeedsRetraining, Disabled

    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Period this metric covers (e.g., "2024-03-01 to 2024-03-15")
    /// </summary>
    [MaxLength(100)]
    public string? EvaluationPeriod { get; set; }
}

/// <summary>
/// Data quality issues detected by AI
/// </summary>
public class DataQualityIssue
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(50)]
    public string IssueType { get; set; } = string.Empty; // MissingData, InconsistentData, UnrealisticValue, DuplicateEntry, InvalidFormat, Outlier

    [MaxLength(20)]
    public string Severity { get; set; } = "Medium"; // Critical, High, Medium, Low

    [MaxLength(100)]
    public string EntityType { get; set; } = string.Empty; // MarketPrice, HarvestDeclaration, Lot, Contract, etc.

    public Guid? EntityId { get; set; }

    [MaxLength(100)]
    public string FieldName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? CurrentValue { get; set; }

    [MaxLength(500)]
    public string? ExpectedValue { get; set; }

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? SuggestedCorrection { get; set; }

    // === Context ===
    [MaxLength(100)]
    public string? Crop { get; set; }

    [MaxLength(100)]
    public string? Region { get; set; }

    public Guid? ReportedByUserId { get; set; }

    // === Status ===
    [MaxLength(30)]
    public string Status { get; set; } = "Open"; // Open, AutoCorrected, ManuallyCorrected, Ignored

    public bool AutoCorrectable { get; set; }
    public bool WasAutoCorrected { get; set; }

    public Guid? CorrectedBy { get; set; }
    public DateTime? CorrectedAt { get; set; }

    [MaxLength(500)]
    public string? CorrectionNotes { get; set; }

    public DateTime DetectedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// System configuration for AI and automation features
/// </summary>
public class SystemConfiguration
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(100)]
    public string Key { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Value { get; set; } = string.Empty;

    [MaxLength(50)]
    public string ValueType { get; set; } = "String"; // String, Int, Decimal, Bool, Json

    [MaxLength(50)]
    public string Category { get; set; } = "General"; // General, AI, Forecasting, Alerts, Automation, Security

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsEditable { get; set; } = true;

    public Guid? LastModifiedBy { get; set; }
    public DateTime? LastModifiedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Scheduled automation tasks
/// </summary>
public class ScheduledTask
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(100)]
    public string TaskName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string TaskType { get; set; } = string.Empty; // ForecastGeneration, DataCleanup, ModelRetraining, AlertScan, ReportGeneration

    [MaxLength(100)]
    public string CronExpression { get; set; } = string.Empty; // e.g., "0 0 * * *" for daily at midnight

    public bool IsEnabled { get; set; } = true;

    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }

    [MaxLength(30)]
    public string? LastRunStatus { get; set; } // Success, Failed, Skipped

    [MaxLength(500)]
    public string? LastRunResult { get; set; }

    public int FailureCount { get; set; }

    [MaxLength(2000)]
    public string? Parameters { get; set; } // JSON parameters for the task

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedBy { get; set; }
}
