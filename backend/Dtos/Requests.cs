using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Dtos;

public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password);

public record LoginResponse(string Token, string FullName, IEnumerable<string> Roles);

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
    [Required] string Location,
    [Required] string Phone,
    [Required, EmailAddress] string Email);

public record CreateMarketListingRequest(
    [Required] string Crop,
    [Required] double QuantityKg,
    [Required] decimal MinimumPrice,
    [Required] DateTime AvailabilityWindowStart,
    [Required] DateTime AvailabilityWindowEnd,
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
    int? Days);

public record UpdateSystemConfigRequest(
    [Required] string ConfigKey,
    [Required] string ConfigValue);

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
    Guid? CooperativeId);

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
    decimal AgreedPrice);

public record CreateTransportRequest(
    Guid? ContractId,
    [Required] string Origin,
    [Required] string Destination,
    [Required] double LoadKg,
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

public record EnableOtpRequest(
    [Required] bool Enable);

