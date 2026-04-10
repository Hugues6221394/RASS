using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Dtos;

// Identifier can be email or phone (phone only for Farmers)
public record LoginRequest([Required] string Identifier, [Required] string Password, string? Otp = null);

public record LoginResponse(
    Guid Id,
    string Token,
    string FullName,
    IEnumerable<string> Roles,
    bool RequiresTwoFactor = false,
    string? TwoFactorMessage = null);

// --- Farmer First-Time Activation ---
public record FarmerActivationCheckRequest([Required] string Identifier); // phone or email

public record FarmerActivationCheckResponse(Guid UserId, string FullName, bool NeedsPasswordSetup);

public record FarmerActivationCompleteRequest(
    [Required] Guid UserId,
    [Required, MinLength(6)] string Password,
    [Required, MinLength(6)] string ConfirmPassword);

public record FarmerActivationCompleteResponse(bool Success, string Message);

// --- Password Reset with OTP ---
public record ForgotPasswordRequest([Required] string Identifier); // email or phone

public record VerifyOtpRequest([Required] string Identifier, [Required] string Otp);

public record ResetPasswordRequest(
    [Required] string Identifier,
    [Required] string Otp,
    [Required, MinLength(6)] string NewPassword,
    [Required, MinLength(6)] string ConfirmPassword);

public record ResetPasswordResponse(bool Success, string Message, string? Code = null);

// --- Admin/Manager Reset Farmer Password ---
public record AdminResetFarmerPasswordResponse(bool Success, string Message);

// --- Buyer Self-Registration ---
public record RegisterBuyerRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    [Required] string Phone,
    string Organization,
    string BusinessType,
    string Location,
    string TaxId);

public record RegisterFarmerRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    [Required] string Phone,
    [Required] string District,
    [Required] string Sector,
    [Required] string NationalId,
    string Crops,
    double FarmSizeHectares,
    Guid? CooperativeId);

public record CreateHarvestDeclarationRequest(
    [Required] string Crop,
    [Required] double ExpectedQuantityKg,
    [Required] DateTime ExpectedHarvestDate,
    string QualityIndicators);

public record ReviewHarvestDeclarationRequest(
    [Required] string Status); // Approved, Rejected

public record CreateCooperativeRequest(
    [Required] string Name,
    [Required] string Region,
    [Required] string District,
    [Required] string Sector,
    string? Cell,
    [Required] string Location,
    [Required] string Phone,
    [Required, EmailAddress] string Email);

public record CreateMarketListingRequest(
    Guid? LotId,
    [Required] string Crop,
    [Required] double QuantityKg,
    decimal? MarketPriceReference,
    [Required] decimal MinimumPrice,
    [Required] DateTime AvailabilityWindowStart,
    [Required] DateTime AvailabilityWindowEnd,
    string? Location,
    string Description,
    string QualityGrade);

public record RespondToOrderRequest(
    [Required] bool Accepted);

public record CreateBuyerRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    [Required] string Password,
    [Required] string Organization,
    [Required] string BusinessType,
    [Required] string Location,
    [Required] string Phone,
    string TaxId);

public record SearchMarketplaceRequest(
    string? Crop,
    double? MinQuantity,
    decimal? MaxPrice,
    string? Region);

public record UpdateBuyerProfileRequest(
    string? Organization,
    string? BusinessType,
    string? Location,
    string? Phone);

public record InitiatePaymentRequest(
    [Required] string PaymentMethod); // MobileMoney, BankTransfer

public record ConfirmDeliveryRequest(
    [Required] bool QualitySatisfactory,
    string? Notes);

public record CreateTransporterRequest(
    [Required] string CompanyName,
    [Required] string ContactPerson,
    [Required, EmailAddress] string Email,
    [Required] string Password,
    [Required] string LicenseNumber,
    [Required] string Phone,
    [Required] double CapacityKg,
    [Required] string VehicleType,
    [Required] string LicensePlate,
    [Required] IEnumerable<string> OperatingRegions);

public record AcceptJobRequest(
    string? DriverPhone);

public record ConfirmDeliveryTransporterRequest(
    string? Notes,
    string? ProofOfDeliveryUrl);

public record SuspendUserRequest(
    [Required] string Reason);

public record VerifyEntityRequest(
    [Required] bool Approved,
    string? Notes);

public record GetMarketPricesRequest(
    string? Crop,
    string? Market,
    int? Days);

public record GetAuditLogsRequest(
    string? Action,
    string? Actor,
    string? EntityType,
    string? Search,
    int? Days,
    DateTime? StartDate = null,
    DateTime? EndDate = null);

public record UpdateSystemConfigRequest(
    [Required] string ConfigKey,
    [Required] string ConfigValue);

public record MaintenanceToggleRequest(
    bool Enabled,
    string? Reason);

public record AdminResetPasswordRequest(
    string? NewPassword);

public record AssignManagerRequest(
    [Required] Guid ManagerId);

public record SettleFarmerPaymentsRequest(
    [Required] Guid ContractId,
    [Required] string PaymentMethod); // MobileMoney, BankTransfer

public record AssignStorageRequest(
    [Required] Guid StorageFacilityId,
    [Required] DateTime StartDate,
    [Required] DateTime EndDate);

public record AssignTransporterRequest(
    [Required] Guid TransporterId,
    string? DriverPhone);

public record CreateLotRequest(
    [Required] string Crop,
    [Required] double QuantityKg,
    string QualityGrade,
    DateTime ExpectedHarvestDate,
    Guid? CooperativeId,
    IEnumerable<FarmerContributionRequest>? FarmerContributions,
    // Enhanced data fields for AI
    double? MoisturePercent,
    Guid? StorageFacilityId,
    decimal? ExpectedPricePerKg,
    string? Season,
    string? ProductionMethod,
    double? LandAreaHectares,
    DateTime? HarvestDate,
    string? QualityNotes);

public record UpdateLotRequest(
    string? Crop,
    double? QuantityKg,
    string? QualityGrade,
    DateTime? ExpectedHarvestDate,
    double? MoisturePercent,
    decimal? ExpectedPricePerKg,
    string? Season,
    string? QualityNotes);

public record FarmerContributionRequest(
    [Required] Guid FarmerId,
    [Required] double QuantityKg);

public record SubmitMarketPriceRequest(
    [Required] string Market,
    [Required] string Crop,
    [Required] decimal PricePerKg,
    DateTime? ObservedAt);

public record CreateBuyerOrderRequest(
    [Required] string Crop,
    [Required] double QuantityKg,
    [Required] decimal PriceOffer,
    Guid? MarketListingId,
    [Required] string DeliveryLocation,
    DateTime DeliveryWindowStart,
    DateTime DeliveryWindowEnd,
    string? Notes);

public record CreateContractRequest(
    [Required] Guid BuyerOrderId,
    [Required] IEnumerable<Guid> LotIds,
    decimal AgreedPrice,
    [Required] string DeliveryTerms,
    [Required] string PaymentTerms,
    string? PenaltyClause,
    DateTime? DeliveryDeadline);

public record CreateTransportRequest(
    Guid? ContractId,
    [Required] string Origin,
    [Required] string Destination,
    [Required] double LoadKg,
    [Required] double DistanceKm,
    [Required] double EstimatedDeliveryHours,
    Guid? TransporterId,
    DateTime PickupStart,
    DateTime PickupEnd,
    decimal Price);

public record CreateStorageBookingRequest(
    [Required] Guid StorageFacilityId,
    Guid? ContractId,
    Guid? LotId,
    [Required] double QuantityKg,
    DateTime StartDate,
    DateTime EndDate);

public record CreateUserRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    string? Password,
    [Required] string Role);

public record UpdateUserRequest(
    string? FullName,
    [EmailAddress] string? Email,
    string? Role,
    string? Phone,
    bool? IsActive);

public record UpdateProfileRequest(
    string? Phone,
    string? District,
    string? Sector,
    string? Crops,
    string? Organization,
    string? BusinessType,
    string? Location,
    string? CompanyName,
    string? VehicleType,
    string? VehiclePlate,
    double? CapacityKg,
    bool? Availability);

public record UpdatePasswordRequest(
    [Required] string CurrentPassword,
    [Required] string NewPassword);

public record ForecastPriceRequest(
    [Required] string Crop,
    [Required] string Market,
    int Days = 7);

public record EnableOtpRequest(
    [Required] bool Enable);

public record VerifyOtpSetupRequest([Required] string OtpCode);

public record DisableOtpRequest([Required] string OtpCode);

public record RequestEmailChangeRequest([Required, EmailAddress] string NewEmail);

public record ConfirmEmailChangeRequest([Required] string OtpCode);

public record RequestPhoneChangeRequest([Required] string NewPhone);

public record ConfirmPhoneChangeRequest([Required] string OtpCode);

public record UpdateNotificationPreferencesRequest(
    bool NotifyInApp,
    bool NotifyEmail,
    bool NotifySecurityAlerts,
    bool NotifyMarketing);

// Cooperative Manager - Farmer Management
public record AddFarmerRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    [Required] string Phone,
    [Required] string NationalId,
    [Required] string District,
    [Required] string Sector,
    string Crops,
    double FarmSizeHectares);

public record UpdateFarmerRequest(
    string? FullName,
    string? Phone,
    string? District,
    string? Sector,
    string? Crops,
    double? FarmSizeHectares,
    bool? IsActive);

// Cooperative Manager - Market Listing Management
public record UpdateMarketListingRequest(
    string? Crop,
    double? QuantityKg,
    decimal? MarketPriceReference,
    decimal? MinimumPrice,
    DateTime? AvailabilityWindowStart,
    DateTime? AvailabilityWindowEnd,
    string? Location,
    string? Description,
    string? QualityGrade,
    string? Status);

public record SetListingStatusRequest(
    [Required] string Status,
    string? Reason);

// Image DTOs
public record AddListingImageRequest(
    [Required] string ImageBase64,
    int DisplayOrder);

public record RemoveListingImageRequest(
    [Required] Guid ImageId);

public record UpdateTransportStatusRequest(
    [Required] string Status,
    string? Notes,
    string? ProofOfDeliveryUrl);

public record HandleStorageBookingRequest(
    [Required] bool Approved,
    string? Notes);

// Farmer Profile & Feedback DTOs
public record UpdateFarmerProfileRequest(
    string? FullName,
    string? Phone,
    string? District,
    string? Sector,
    string? Crops,
    double? FarmSizeHectares);

public record UpdateHarvestDeclarationRequest(
    string? Crop,
    double? ExpectedQuantityKg,
    DateTime? ExpectedHarvestDate,
    string? QualityIndicators);

public record SubmitFeedbackRequest(
    [Required] string Category, // Bug, Feature, Complaint, Compliment, Other
    [Required] string Subject,
    [Required] string Message);

// Market Agent Price Correction
public record UpdateMarketPriceRequest(
    string? Market,
    string? Crop,
    decimal? PricePerKg,
    DateTime? ObservedAt,
    string? Notes);

// Storage Operator DTOs
public record CreateStorageFacilityRequest(
    [Required] string Name,
    [Required] string Location,
    [Required] double CapacityKg,
    double? AvailableKg,
    string? Features);

public record UpdateStorageFacilityRequest(
    string? Name,
    string? Location,
    double? CapacityKg,
    double? AvailableKg,
    string? Features);

public record UpdateStorageBookingRequest(
    string? Status,
    DateTime? StartDate,
    DateTime? EndDate,
    double? QuantityKg);

// Government/Policy Maker DTOs
public record CreatePolicyReportRequest(
    [Required] string Title,
    [Required] string Content,
    string? Category);

public record AddPolicyAnnotationRequest(
    [Required] string Content,
    string? ReferenceEntityType,
    string? ReferenceEntityId);

public record UpdatePolicyAnnotationRequest(
    [Required] string Content);

// Market Agent Report
public record MarketReportRequest(
    [Required] string Market,
    [Required] string ReportType,
    [Required] string Severity,
    [Required] string Description,
    string? AffectedCrops);

// Admin System Configuration
public record UpdateForecastingConfigRequest(
    string? ModelType,
    double? ConfidenceLevel,
    int? ForecastHorizonDays,
    string? Parameters);

// === Contract Lifecycle DTOs ===
public record RequestSignatureRequest(
    [Required] string Party); // "Buyer" or "Seller"

public record UploadContractDocumentRequest(
    [Required] string Party,
    [Required] string DocumentTitle,
    [Required] string DocumentContent,
    string? DocumentMimeType);

public record ReviewContractRequest(
    [Required] string Party,
    [Required] bool Approved,
    string? Comment);

public record VerifySignatureRequest(
    [Required] string Party, // "Buyer" or "Seller"
    [Required] string Otp);

public record FundEscrowRequest(
    [Required] decimal Amount,
    [Required] string PaymentMethod); // MobileMoney, BankTransfer

public record DisputeContractRequest(
    [Required] string Reason);

public record ResolveDisputeRequest(
    [Required] string Resolution, // "ReleaseFunds", "Refund", "PartialRefund"
    decimal? RefundAmount,
    string? Notes);

// === Admin Broadcast DTOs ===
public record BroadcastNotificationRequest(
    [Required] string Title,
    [Required] string Message,
    string? TargetRole); // null = all users

public record ScheduleMaintenanceRequest(
    [Required] DateTime ScheduledStart,
    [Required] DateTime ScheduledEnd,
    [Required] string Description);

// === AI Control DTOs ===
public record StartModelTrainingRequest(
    [Required] string ModelType, // ARIMA, SARIMA, Prophet, LSTM, XGBoost, Ensemble
    string? Crop,
    string? Market,
    int? TrainingDataDays,
    string? DatasetKey);

public record UpdateFeatureConfigRequest(
    [Required] string ModelType,
    [Required] List<string> Features);

public record RegisterDatasetRequest(
    [Required] string Key,
    [Required] string Name,
    string? Source,
    string? Description);

public record SetActiveDatasetRequest(
    [Required] string DatasetKey);

public record BindModelDatasetRequest(
    [Required] string ModelType,
    [Required] string DatasetKey);

public record FileUploadPayload(
    [Required] string FileName,
    [Required] string ContentType,
    [Required] string Base64Content);

// === Role Application Workflow DTOs ===
public record SubmitRoleApplicationRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    [Required] string Phone,
    [Required, MinLength(6)] string Password,
    [Required] string TargetRole,
    string? OrganizationName,
    int? FarmersCount,
    double? FarmSizeHectares,
    string? Province,
    string? District,
    string? Sector,
    string? Cell,
    string? Location,
    string? OrganizationEmail,
    string? OrganizationPhone,
    string? VehicleType,
    string? LicenseNumber,
    string? PlateNumber,
    FileUploadPayload? DrivingLicenseDocument,
    string? StorageLocation,
    string? WarehouseCapacity,
    FileUploadPayload? RdbCertificateDocument,
    string? Notes);

public record UpdateCooperativeProfileRequest(
    string? Name,
    string? Phone,
    [EmailAddress] string? Email,
    string? Region,
    string? District,
    string? Sector,
    string? Cell,
    string? Location);

public record ApplicationMessageRequest(
    [Required] string Message);

public record ApplicationDocumentRequest(
    [Required] string DocumentName,
    [Required] string FileName,
    [Required] string ContentType,
    [Required] string Base64Content);

public record ProcessApplicationRequest(
    [Required] bool Approved,
    string? Note);

public record CreateCropCatalogRequest(
    [Required] string Name);

public record RejectCropRequest(
    string? Reason = null);

public record CreateRegisteredMarketRequest(
    [Required] string Name,
    [Required] string Province,
    [Required] string District,
    [Required] string Sector,
    string? Cell,
    string? Location);

// === Government Price Regulation ===
public record CreatePriceRegulationRequest(
    [Required] string Crop,
    [Required] string Region,
    string? Market,
    string? District,
    decimal? MinPricePerKg,
    [Required] decimal MaxPricePerKg,
    [Required] DateTime EffectiveFrom,
    [Required] DateTime EffectiveTo,
    string? Notes);

public record UpdatePriceRegulationRequest(
    decimal? MinPricePerKg,
    decimal? MaxPricePerKg,
    DateTime? EffectiveFrom,
    DateTime? EffectiveTo,
    string? Status,
    string? Notes);

// === Seasonal Guidance ===
public record CreateSeasonalGuidanceRequest(
    [Required] string Crop,
    [Required] string Region,
    [Required] string Season,
    [Required] DateTime StabilityStart,
    [Required] DateTime StabilityEnd,
    [Required] string ExpectedTrend,
    decimal? ExpectedMinPrice,
    decimal? ExpectedMaxPrice,
    string? Notes,
    string? RecommendationForFarmers);

// === Inter-Cooperative Crop Sharing ===
public record CreateCropShareRequestDto(
    [Required] string Crop,
    [Required] double QuantityKg,
    decimal? OfferedPricePerKg,
    string? UrgencyLevel,
    string? Notes,
    bool BroadcastToAll = true,
    Guid? TargetCooperativeId = null);

public record RespondToCropShareRequest(
    [Required] bool Accepted,
    decimal? AgreedPricePerKg,
    double? AgreedQuantityKg,
    string? DeliveryTerms,
    string? ResponseNotes);

public record SubmitCropShareBidRequest(
    [Required] decimal ProposedPricePerKg,
    [Required] double ProposedQuantityKg,
    string? DeliveryTerms,
    string? Notes);

public record SelectCropShareBidRequest(
    [Required] Guid BidId);

// === Harvest Declaration Review (Enhanced) ===
public record ReviewHarvestDeclarationEnhancedRequest(
    [Required] string Status,
    [Required] string ConditionGrade,
    [Required] string ConditionNote);

// === Cooperative Registration (Enhanced) ===
public record CreateCooperativeEnhancedRequest(
    [Required] string Name,
    [Required] string Region,
    [Required] string District,
    [Required] string Sector,
    string? Cell,
    [Required] string Location,
    [Required] string Phone,
    [Required, EmailAddress] string Email);

// === Report Generation ===
public record GenerateReportRequest(
    [Required] string ReportType,
    string? Crop,
    string? Region,
    string? District,
    DateTime? StartDate,
    DateTime? EndDate,
    string? Aggregation);

// === Transport Job Posting ===
public record CreateTransportJobRequest(
    [Required] string Title,
    string? Description,
    [Required] string Crop,
    [Required] double QuantityKg,
    string? QualityGrade,
    [Required] string PickupLocation,
    [Required] string DeliveryLocation,
    double? DistanceKm,
    DateTime? PickupDate,
    DateTime? DeliveryDeadline,
    decimal? MinPaymentRwf,
    decimal? MaxPaymentRwf,
    string? PaymentTerms,
    string? RequiredVehicleType,
    bool RequiresColdChain,
    string? SpecialInstructions);

public record ApplyToTransportJobRequest(
    [Required] decimal ProposedPriceRwf,
    string? VehicleType,
    string? PlateNumber,
    double? VehicleCapacityKg,
    string? CoverLetter,
    int? EstimatedDeliveryHours,
    string? DriverPhone,
    string? DrivingLicenseBase64,
    string? DrivingLicenseFileName,
    string? InsuranceDocBase64,
    string? InsuranceDocFileName);

public record ProcessTransportJobApplicationRequest(
    [Required] bool Accepted,
    string? ReviewNote);

// === Price Moderation ===
public record ModerateMarketPriceRequest(
    [Required] string Status,
    string? Note);
