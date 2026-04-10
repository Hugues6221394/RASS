using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Hubs;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ContractsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hubContext;

    public ContractsController(AppDbContext db, IHubContext<NotificationHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    // ============================================================
    // GET /api/contracts — List contracts visible to the current user
    // ============================================================
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetContracts([FromQuery] string? status = null)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var query = _db.Contracts
            .Include(c => c.BuyerOrder)
                .ThenInclude(o => o.BuyerProfile)
                    .ThenInclude(b => b.User)
            .Include(c => c.BuyerOrder)
                .ThenInclude(o => o.MarketListing)
            .Include(c => c.ContractLots)
                .ThenInclude(cl => cl.Lot)
            .Include(c => c.TransportRequests)
            .Include(c => c.StorageBookings)
            .AsQueryable();

        // Role-based filtering
        if (User.IsInRole("Buyer"))
        {
            query = query.Where(c => c.BuyerOrder != null && c.BuyerOrder.BuyerProfile != null &&
                                     c.BuyerOrder.BuyerProfile.UserId == userId.Value);
        }
        else if (User.IsInRole("CooperativeManager"))
        {
            var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
            if (cooperative == null) return NotFound("Cooperative not found");

            query = query.Where(c =>
                c.ContractLots.Any(cl => cl.Lot.CooperativeId == cooperative.Id) ||
                (c.BuyerOrder != null && c.BuyerOrder.MarketListing != null && c.BuyerOrder.MarketListing.CooperativeId == cooperative.Id));
        }
        else if (User.IsInRole("Farmer"))
        {
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
            if (farmer?.CooperativeId == null) return Ok(Array.Empty<object>());
            var cooperativeId = farmer.CooperativeId.Value;
            query = query.Where(c =>
                c.ContractLots.Any(cl => cl.Lot.CooperativeId == cooperativeId) ||
                (c.BuyerOrder != null && c.BuyerOrder.MarketListing != null && c.BuyerOrder.MarketListing.CooperativeId == cooperativeId));
        }
        else if (User.IsInRole("Transporter"))
        {
            var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == userId.Value);
            if (transporter == null) return Ok(Array.Empty<object>());
            query = query.Where(c => c.TransportRequests.Any(t => t.TransporterId == transporter.Id));
        }
        else if (User.IsInRole("StorageOperator") || User.IsInRole("StorageManager"))
        {
            query = query.Where(c => c.StorageBookings.Any());
        }
        else if (!User.IsInRole("Admin"))
        {
            return Forbid();
        }

        // Optional status filter
        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(c => c.Status == status);
        }

        var contracts = await query
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.BuyerOrderId,
                c.AgreedPrice,
                c.TotalValue,
                c.TotalQuantityKg,
                c.Status,
                c.TrackingId,
                c.DeliveryTerms,
                c.PaymentTerms,
                c.PenaltyClause,
                c.ContractSource,
                c.DocumentTitle,
                c.BuyerApproved,
                c.BuyerApprovedAt,
                c.SellerApproved,
                c.SellerApprovedAt,
                c.DeliveryDeadline,
                c.BuyerSigned,
                c.BuyerSignedAt,
                c.SellerSigned,
                c.SellerSignedAt,
                c.EscrowStatus,
                c.EscrowAmount,
                c.EscrowFundedAt,
                c.EscrowReleasedAt,
                c.DisputeReason,
                c.DisputedAt,
                c.DisputeResolution,
                c.DisputeResolvedAt,
                c.CreatedAt,
                c.ActivatedAt,
                c.CompletedAt,
                Buyer = c.BuyerOrder != null && c.BuyerOrder.BuyerProfile != null && c.BuyerOrder.BuyerProfile.User != null
                    ? c.BuyerOrder.BuyerProfile.User.FullName : "N/A",
                BuyerOrg = c.BuyerOrder != null && c.BuyerOrder.BuyerProfile != null
                    ? c.BuyerOrder.BuyerProfile.Organization : "N/A",
                Crop = c.BuyerOrder != null ? c.BuyerOrder.Crop : "N/A",
                Lots = c.ContractLots.Select(l => new { l.LotId, l.Lot.Crop, l.Lot.QuantityKg })
            })
            .ToListAsync();

        return Ok(contracts);
    }

    // ============================================================
    // GET /api/contracts/{id} — Get single contract detail
    // ============================================================
    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetContract(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await _db.Contracts
            .Include(c => c.BuyerOrder)
                .ThenInclude(o => o.BuyerProfile)
                    .ThenInclude(b => b.User)
            .Include(c => c.BuyerOrder)
                .ThenInclude(o => o.MarketListing)
                    .ThenInclude(l => l.Cooperative)
            .Include(c => c.ContractLots)
                .ThenInclude(cl => cl.Lot)
            .Include(c => c.TransportRequests)
            .Include(c => c.StorageBookings)
            .Include(c => c.PaymentLedgers)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract == null) return NotFound("Contract not found");
        if (!await HasContractAccess(contract, userId.Value)) return Forbid();

        return Ok(new
        {
            contract.Id,
            contract.BuyerOrderId,
            contract.AgreedPrice,
            contract.TotalValue,
            contract.TotalQuantityKg,
            contract.Status,
            contract.TrackingId,
            contract.DeliveryTerms,
            contract.PaymentTerms,
            contract.PenaltyClause,
            contract.ContractSource,
            contract.DocumentTitle,
            contract.DocumentContent,
            contract.DeliveryDeadline,
            Review = new
            {
                contract.BuyerApproved,
                contract.BuyerApprovedAt,
                contract.SellerApproved,
                contract.SellerApprovedAt,
                BothApproved = contract.BuyerApproved && contract.SellerApproved
            },
            Signature = new
            {
                contract.BuyerSigned,
                contract.BuyerSignedAt,
                contract.SellerSigned,
                contract.SellerSignedAt,
                BothSigned = contract.BuyerSigned && contract.SellerSigned
            },
            Escrow = new
            {
                contract.EscrowStatus,
                contract.EscrowAmount,
                contract.EscrowFundedAt,
                contract.EscrowReleasedAt
            },
            Dispute = new
            {
                contract.DisputeReason,
                contract.DisputedAt,
                contract.DisputeResolution,
                contract.DisputeResolvedAt,
                contract.DisputeResolvedBy
            },
            Buyer = contract.BuyerOrder?.BuyerProfile?.User?.FullName ?? "N/A",
            BuyerOrg = contract.BuyerOrder?.BuyerProfile?.Organization ?? "N/A",
            Cooperative = contract.BuyerOrder?.MarketListing?.Cooperative?.Name ?? "N/A",
            Crop = contract.BuyerOrder?.Crop ?? "N/A",
            Quantity = contract.BuyerOrder?.QuantityKg ?? 0,
            Lots = contract.ContractLots.Select(l => new { l.LotId, l.Lot.Crop, l.Lot.QuantityKg }),
            Deliveries = contract.TransportRequests.Select(t => new { t.Id, t.Status, t.Origin, t.Destination }),
            Payments = contract.PaymentLedgers.Select(p => new { p.Id, p.Amount, p.Status, p.Type, p.CreatedAt }),
            contract.CreatedAt,
            contract.ActivatedAt,
            contract.CompletedAt
        });
    }

    // ============================================================
    // POST /api/contracts — Create a new contract
    // ============================================================
    [HttpPost]
    [Authorize(Roles = "Buyer,CooperativeManager,StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> CreateContract(CreateContractRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DeliveryTerms))
            return BadRequest("Delivery terms are required.");
        if (string.IsNullOrWhiteSpace(request.PaymentTerms))
            return BadRequest("Payment terms are required.");

        var order = await _db.BuyerOrders
            .Include(o => o.BuyerProfile)
            .FirstOrDefaultAsync(o => o.Id == request.BuyerOrderId);
        if (order == null) return NotFound("Order not found.");

        var lots = await _db.Lots.Where(l => request.LotIds.Contains(l.Id)).ToListAsync();
        if (!lots.Any()) return BadRequest("No valid lots provided.");

        var totalQuantity = lots.Sum(l => l.QuantityKg);
        var agreedPrice = request.AgreedPrice > 0 ? request.AgreedPrice : order.PriceOffer;

        var contract = new Contract
        {
            Id = Guid.NewGuid(),
            BuyerOrderId = order.Id,
            AgreedPrice = agreedPrice,
            TotalQuantityKg = totalQuantity,
            TotalValue = agreedPrice * (decimal)totalQuantity,
            Status = "PendingApproval",
            TrackingId = $"RASS-{Random.Shared.Next(100000, 999999)}",
            DeliveryTerms = request.DeliveryTerms.Trim(),
            PaymentTerms = request.PaymentTerms.Trim(),
            PenaltyClause = request.PenaltyClause?.Trim() ?? string.Empty,
            DeliveryDeadline = request.DeliveryDeadline ?? DateTime.UtcNow.AddDays(14),
            ContractSource = "AutoGenerated",
            DocumentTitle = $"RASS Supply Contract {order.Crop}",
            DocumentContent = BuildAutoContractDocument(order, lots, agreedPrice, totalQuantity)
        };

        foreach (var lot in lots)
        {
            contract.ContractLots.Add(new ContractLot { ContractId = contract.Id, LotId = lot.Id });
        }

        _db.Contracts.Add(contract);
        order.Status = "Accepted";
        UpdateBuyerOrderStatusForContract(contract);

        // Audit
        _db.AuditLogs.Add(new AuditLog
        {
            Action = "CONTRACT_CREATED",
            Actor = GetUserId()?.ToString() ?? "System",
            EntityType = "Contract",
            EntityId = contract.Id.ToString(),
            Metadata = $"{{\"trackingId\":\"{contract.TrackingId}\",\"value\":{contract.TotalValue}}}"
        });

        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Contract created", "A new contract was created and is pending approval.", "Info");
        return CreatedAtAction(nameof(GetContract), new { id = contract.Id }, new { contract.Id, contract.TrackingId, contract.Status });
    }

    // ============================================================
    // POST /api/contracts/{id}/upload-document — Manual document upload/edit
    // ============================================================
    [HttpPost("{id}/upload-document")]
    [Authorize(Roles = "Buyer,CooperativeManager,StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> UploadContractDocument(Guid id, UploadContractDocumentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");
        if (!await HasContractAccess(contract, userId.Value)) return Forbid();

        var partyAuthorized = await IsAuthorizedForPartyAction(contract, request.Party, userId.Value);
        if (!partyAuthorized) return Forbid();
        if (string.IsNullOrWhiteSpace(request.DocumentTitle) || request.DocumentTitle.Length > 200)
            return BadRequest("Document title is required and must be <= 200 characters.");
        if (string.IsNullOrWhiteSpace(request.DocumentContent) || request.DocumentContent.Length > 8000)
            return BadRequest("Document content is required and must be <= 8000 characters.");
        if (!string.IsNullOrWhiteSpace(request.DocumentMimeType) &&
            request.DocumentMimeType.Length > 100)
            return BadRequest("Invalid document mime type.");

        contract.ContractSource = "ManualUpload";
        contract.DocumentTitle = request.DocumentTitle.Trim();
        contract.DocumentContent = request.DocumentContent.Trim();
        contract.Status = "PendingApproval";
        contract.BuyerApproved = false;
        contract.BuyerApprovedAt = null;
        contract.SellerApproved = false;
        contract.SellerApprovedAt = null;
        contract.BuyerSigned = false;
        contract.BuyerSignedAt = null;
        contract.BuyerSignatureOtp = null;
        contract.SellerSigned = false;
        contract.SellerSignedAt = null;
        contract.SellerSignatureOtp = null;
        UpdateBuyerOrderStatusForContract(contract);

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "CONTRACT_DOCUMENT_UPLOADED",
            Actor = userId.ToString(),
            EntityType = "Contract",
            EntityId = contract.Id.ToString(),
            Metadata = $"{{\"party\":\"{request.Party}\",\"source\":\"{contract.ContractSource}\"}}"
        });

        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Contract updated", "Contract document uploaded and sent for review.", "Info");
        return Ok(new { message = "Contract document uploaded and sent for review.", status = contract.Status });
    }

    // ============================================================
    // POST /api/contracts/{id}/review — Buyer/Seller approve contract text
    // ============================================================
    [HttpPost("{id}/review")]
    [Authorize(Roles = "Buyer,CooperativeManager,StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> ReviewContract(Guid id, ReviewContractRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");
        var partyAuthorized = await IsAuthorizedForPartyAction(contract, request.Party, userId.Value);
        if (!partyAuthorized) return Forbid();

        if (request.Party.Equals("Buyer", StringComparison.OrdinalIgnoreCase))
        {
            contract.BuyerApproved = request.Approved;
            contract.BuyerApprovedAt = DateTime.UtcNow;
        }
        else if (request.Party.Equals("Seller", StringComparison.OrdinalIgnoreCase))
        {
            contract.SellerApproved = request.Approved;
            contract.SellerApprovedAt = DateTime.UtcNow;
        }
        else
        {
            return BadRequest("Party must be 'Buyer' or 'Seller'.");
        }

        contract.Status = contract.BuyerApproved && contract.SellerApproved ? "PendingSignature" : "PendingApproval";
        if (!request.Approved && !string.IsNullOrWhiteSpace(request.Comment))
        {
            contract.DocumentContent = $"{contract.DocumentContent ?? string.Empty}\n\nAMENDMENT REQUEST ({request.Party}, {DateTime.UtcNow:O}): {request.Comment.Trim()}";
        }
        if (!contract.BuyerApproved || !contract.SellerApproved)
        {
            contract.BuyerSigned = false;
            contract.BuyerSignedAt = null;
            contract.BuyerSignatureOtp = null;
            contract.SellerSigned = false;
            contract.SellerSignedAt = null;
            contract.SellerSignatureOtp = null;
        }
        UpdateBuyerOrderStatusForContract(contract);

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "CONTRACT_REVIEW_VOTE",
            Actor = userId.ToString(),
            EntityType = "Contract",
            EntityId = contract.Id.ToString(),
            Metadata = $"{{\"party\":\"{request.Party}\",\"approved\":{request.Approved.ToString().ToLower()},\"comment\":\"{(request.Comment ?? "").Replace("\"", "'")}\"}}"
        });

        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Contract review update", request.Approved ? "A contract review vote was approved." : "An amendment was requested on a contract.", request.Approved ? "Info" : "Warning");
        return Ok(new
        {
            message = request.Approved ? "Vote recorded." : "Contract remains pending until both parties approve.",
            buyerApproved = contract.BuyerApproved,
            sellerApproved = contract.SellerApproved,
            status = contract.Status
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Buyer,CooperativeManager,StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> DeleteContract(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");
        if (!await HasContractAccess(contract, userId.Value)) return Forbid();
        if (contract.Status != "Completed" && !User.IsInRole("Admin"))
            return BadRequest("Only completed contracts can be deleted.");

        _db.Contracts.Remove(contract);
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "CONTRACT_DELETED",
            Actor = userId.ToString(),
            EntityType = "Contract",
            EntityId = id.ToString(),
            Timestamp = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Contract deleted", "A completed contract was deleted.", "Warning");
        return Ok(new { message = "Contract deleted." });
    }

    // ============================================================
    // POST /api/contracts/{id}/request-signature — Generate OTP
    // ============================================================
    [HttpPost("{id}/request-signature")]
    [Authorize(Roles = "Buyer,CooperativeManager,StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> RequestSignature(Guid id, RequestSignatureRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");

        if (!contract.BuyerApproved || !contract.SellerApproved)
            return BadRequest("Both parties must approve contract review before signature.");
        if (contract.Status != "PendingSignature" && contract.Status != "Draft" && contract.Status != "PendingApproval")
            return BadRequest("Contract is not in a signable state.");

        if (!request.Party.Equals("Buyer", StringComparison.OrdinalIgnoreCase) &&
            !request.Party.Equals("Seller", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Party must be 'Buyer' or 'Seller'");
        }

        var partyAuthorized = await IsAuthorizedForPartyAction(contract, request.Party, userId.Value);
        if (!partyAuthorized) return Forbid();

        if (request.Party.Equals("Buyer", StringComparison.OrdinalIgnoreCase) && contract.BuyerSigned)
            return BadRequest("Buyer already signed this contract.");
        if (request.Party.Equals("Seller", StringComparison.OrdinalIgnoreCase) && contract.SellerSigned)
            return BadRequest("Seller already signed this contract.");

        var contractIdText = contract.Id.ToString();
        var partyToken = $"\"party\":\"{request.Party}\"";
        var recentOtpRequest = await _db.AuditLogs
            .Where(a => a.Action == "CONTRACT_SIGNATURE_OTP_REQUESTED" &&
                        a.EntityType == "Contract" &&
                        a.EntityId == contractIdText &&
                        a.Metadata != null &&
                        a.Metadata.Contains(partyToken))
            .OrderByDescending(a => a.Timestamp)
            .FirstOrDefaultAsync();
        if (recentOtpRequest != null && recentOtpRequest.Timestamp >= DateTime.UtcNow.AddMinutes(-2))
            return BadRequest("OTP was requested recently. Please wait before requesting again.");

        // Generate 6-digit OTP
        var otp = Random.Shared.Next(100000, 999999).ToString();

        if (request.Party.Equals("Buyer", StringComparison.OrdinalIgnoreCase))
        {
            contract.BuyerSignatureOtp = otp;
        }
        else if (request.Party.Equals("Seller", StringComparison.OrdinalIgnoreCase))
        {
            contract.SellerSignatureOtp = otp;
        }
        contract.Status = "PendingSignature";
        UpdateBuyerOrderStatusForContract(contract);

        // ── LOG OTP FOR TESTING (visible in server console/logs) ──
        var logger = HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("OTP");
        logger.LogWarning(
            "OTP_GENERATED | user_id={UserId} | contract_id={ContractId} | party={Party} | otp={Otp} | timestamp={Timestamp}",
            userId, contract.Id, request.Party, otp, DateTime.UtcNow.ToString("O"));

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "CONTRACT_SIGNATURE_OTP_REQUESTED",
            Actor = userId.ToString(),
            EntityType = "Contract",
            EntityId = contract.Id.ToString(),
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                @event = "OTP_GENERATED",
                user_id = userId.ToString(),
                contract_id = contract.Id.ToString(),
                party = request.Party,
                otp,
                timestamp = DateTime.UtcNow.ToString("O")
            })
        });
        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Contract signature OTP", $"Signature OTP requested for {request.Party}.", "Info");

        return Ok(new
        {
            message = $"OTP generated for {request.Party}. Check server logs for OTP code (test mode).",
            otp,
            contractId = id,
            party = request.Party
        });
    }

    // ============================================================
    // POST /api/contracts/{id}/verify-signature — Verify OTP
    // ============================================================
    [HttpPost("{id}/verify-signature")]
    [Authorize(Roles = "Buyer,CooperativeManager,StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> VerifySignature(Guid id, VerifySignatureRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");

        if (!contract.BuyerApproved || !contract.SellerApproved)
            return BadRequest("Both parties must approve contract review before signatures.");
        if (contract.Status != "PendingSignature")
            return BadRequest("Contract is not awaiting signatures.");

        if (!request.Party.Equals("Buyer", StringComparison.OrdinalIgnoreCase) &&
            !request.Party.Equals("Seller", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Party must be 'Buyer' or 'Seller'");
        }

        var partyAuthorized = await IsAuthorizedForPartyAction(contract, request.Party, userId.Value);
        if (!partyAuthorized) return Forbid();

        if (string.IsNullOrWhiteSpace(request.Otp) || request.Otp.Length != 6 || !request.Otp.All(char.IsDigit))
            return BadRequest("OTP must be a 6-digit code.");

        if (request.Party.Equals("Buyer", StringComparison.OrdinalIgnoreCase))
        {
            if (contract.BuyerSigned) return BadRequest("Buyer already signed this contract.");
            if (contract.BuyerSignatureOtp != request.Otp)
                return BadRequest("Invalid OTP for buyer");

            contract.BuyerSigned = true;
            contract.BuyerSignedAt = DateTime.UtcNow;
            contract.BuyerSignatureOtp = null; // Consumed
        }
        else if (request.Party.Equals("Seller", StringComparison.OrdinalIgnoreCase))
        {
            if (contract.SellerSigned) return BadRequest("Seller already signed this contract.");
            if (contract.SellerSignatureOtp != request.Otp)
                return BadRequest("Invalid OTP for seller");

            contract.SellerSigned = true;
            contract.SellerSignedAt = DateTime.UtcNow;
            contract.SellerSignatureOtp = null; // Consumed
        }
        // If both parties signed, activate the contract
        if (contract.BuyerSigned && contract.SellerSigned)
        {
            contract.Status = "Active";
            contract.ActivatedAt = DateTime.UtcNow;
        }
        UpdateBuyerOrderStatusForContract(contract);

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "CONTRACT_SIGNED",
            Actor = GetUserId()?.ToString() ?? "System",
            EntityType = "Contract",
            EntityId = contract.Id.ToString(),
            Metadata = $"{{\"party\":\"{request.Party}\",\"bothSigned\":{(contract.BuyerSigned && contract.SellerSigned).ToString().ToLower()}}}"
        });

        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Contract signature update", $"{request.Party} signature verified successfully.", "Success");

        return Ok(new
        {
            message = $"{request.Party} signature verified successfully",
            buyerSigned = contract.BuyerSigned,
            sellerSigned = contract.SellerSigned,
            status = contract.Status
        });
    }

    // ============================================================
    // POST /api/contracts/{id}/fund-escrow — Buyer deposits funds
    // ============================================================
    [HttpPost("{id}/fund-escrow")]
    [Authorize(Roles = "Buyer,Admin")]
    public async Task<IActionResult> FundEscrow(Guid id, FundEscrowRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");

        if (contract.Status != "Active")
            return BadRequest("Contract must be active to fund escrow");

        if (!contract.BuyerSigned || !contract.SellerSigned)
            return BadRequest("Both parties must sign before funding escrow.");

        if (contract.EscrowStatus == "Funded")
            return BadRequest("Escrow is already funded");
        if (contract.EscrowStatus == "Released" || contract.EscrowStatus == "Refunded")
            return BadRequest($"Escrow is already {contract.EscrowStatus}.");

        if (User.IsInRole("Buyer"))
        {
            var buyerAuthorized = await IsAuthorizedForPartyAction(contract, "Buyer", userId.Value);
            if (!buyerAuthorized) return Forbid();
        }

        if (request.Amount > 0 && request.Amount < contract.TotalValue)
            return BadRequest("Escrow amount must cover the full contract value.");

        contract.EscrowAmount = request.Amount > 0 ? request.Amount : contract.TotalValue;
        contract.EscrowStatus = "Funded";
        contract.EscrowFundedAt = DateTime.UtcNow;
        UpdateBuyerOrderStatusForContract(contract);

        // Record in payment ledger
        _db.PaymentLedgers.Add(new PaymentLedger
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            Amount = contract.EscrowAmount,
            Type = "EscrowDeposit",
            Status = "Completed",
            Reference = $"ESC-{Random.Shared.Next(100000, 999999)}"
        });

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "ESCROW_FUNDED",
            Actor = GetUserId()?.ToString() ?? "System",
            EntityType = "Contract",
            EntityId = contract.Id.ToString(),
            Metadata = $"{{\"amount\":{contract.EscrowAmount},\"method\":\"{request.PaymentMethod}\"}}"
        });

        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Escrow funded", "Contract escrow funded successfully.", "Success");

        return Ok(new
        {
            message = "Escrow funded successfully",
            escrowAmount = contract.EscrowAmount,
            escrowStatus = contract.EscrowStatus
        });
    }

    // ============================================================
    // POST /api/contracts/{id}/release-escrow — Release on delivery
    // ============================================================
    [HttpPost("{id}/release-escrow")]
    [Authorize(Roles = "Buyer,Admin")]
    public async Task<IActionResult> ReleaseEscrow(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");

        if (contract.EscrowStatus != "Funded")
            return BadRequest("Escrow must be funded before release");

        if (contract.Status == "Disputed")
            return BadRequest("Cannot release escrow while contract is disputed.");

        if (User.IsInRole("Buyer"))
        {
            var buyerAuthorized = await IsAuthorizedForPartyAction(contract, "Buyer", userId.Value);
            if (!buyerAuthorized) return Forbid();
        }

        var hasCompletedDelivery = await _db.TransportRequests
            .AnyAsync(t => t.ContractId == contract.Id && (t.Status == "Delivered" || t.Status == "Completed"));
        if (!hasCompletedDelivery)
            return BadRequest("Escrow can only be released after delivery is completed.");

        contract.EscrowStatus = "Released";
        contract.EscrowReleasedAt = DateTime.UtcNow;
        contract.Status = "Completed";
        contract.CompletedAt = DateTime.UtcNow;
        UpdateBuyerOrderStatusForContract(contract);

        // Record release payment
        _db.PaymentLedgers.Add(new PaymentLedger
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            Amount = contract.EscrowAmount,
            Type = "EscrowRelease",
            Status = "Completed",
            Reference = $"REL-{Random.Shared.Next(100000, 999999)}"
        });

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "ESCROW_RELEASED",
            Actor = GetUserId()?.ToString() ?? "System",
            EntityType = "Contract",
            EntityId = contract.Id.ToString(),
            Metadata = $"{{\"amount\":{contract.EscrowAmount}}}"
        });

        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Contract completed", "Escrow released and contract marked completed.", "Success");

        return Ok(new { message = "Escrow released. Contract completed.", status = contract.Status });
    }

    // ============================================================
    // POST /api/contracts/{id}/dispute — Raise a dispute
    // ============================================================
    [HttpPost("{id}/dispute")]
    [Authorize(Roles = "Buyer,CooperativeManager,StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> DisputeContract(Guid id, DisputeContractRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");

        if (contract.Status != "Active" && contract.Status != "InDelivery")
            return BadRequest("Cannot dispute a contract in this state");
        if (contract.Status == "Disputed")
            return BadRequest("Contract is already disputed.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest("Dispute reason is required.");

        if (User.IsInRole("Buyer"))
        {
            var buyerAuthorized = await IsAuthorizedForPartyAction(contract, "Buyer", userId.Value);
            if (!buyerAuthorized) return Forbid();
        }
        else if (User.IsInRole("CooperativeManager"))
        {
            var sellerAuthorized = await IsAuthorizedForPartyAction(contract, "Seller", userId.Value);
            if (!sellerAuthorized) return Forbid();
        }

        contract.Status = "Disputed";
        contract.EscrowStatus = "Disputed";
        contract.DisputeReason = request.Reason;
        contract.DisputedAt = DateTime.UtcNow;
        UpdateBuyerOrderStatusForContract(contract);

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "CONTRACT_DISPUTED",
            Actor = GetUserId()?.ToString() ?? "System",
            EntityType = "Contract",
            EntityId = contract.Id.ToString(),
            Metadata = $"{{\"reason\":\"{request.Reason}\"}}"
        });

        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Contract disputed", "A dispute has been raised on this contract.", "Warning");

        return Ok(new { message = "Dispute raised. Admin will review.", status = contract.Status });
    }

    // ============================================================
    // POST /api/contracts/{id}/resolve-dispute — Admin resolves
    // ============================================================
    [HttpPost("{id}/resolve-dispute")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResolveDispute(Guid id, ResolveDisputeRequest request)
    {
        var contract = await _db.Contracts
            .Include(c => c.BuyerOrder)
            .Include(c => c.PaymentLedgers)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (contract == null) return NotFound("Contract not found");

        if (contract.Status != "Disputed")
            return BadRequest("Contract is not in a disputed state");

        var userId = GetUserId();
        contract.DisputeResolvedBy = userId;
        contract.DisputeResolvedAt = DateTime.UtcNow;
        contract.DisputeResolution = request.Notes ?? request.Resolution;

        switch (request.Resolution)
        {
            case "ReleaseFunds":
                contract.EscrowStatus = "Released";
                contract.EscrowReleasedAt = DateTime.UtcNow;
                contract.Status = "Completed";
                contract.CompletedAt = DateTime.UtcNow;
                _db.PaymentLedgers.Add(new PaymentLedger
                {
                    Id = Guid.NewGuid(),
                    ContractId = contract.Id,
                    Amount = contract.EscrowAmount,
                    Type = "EscrowRelease",
                    Status = "Completed",
                    Reference = $"REL-{Random.Shared.Next(100000, 999999)}"
                });
                break;
            case "Refund":
                contract.EscrowStatus = "Refunded";
                contract.Status = "Cancelled";
                _db.PaymentLedgers.Add(new PaymentLedger
                {
                    Id = Guid.NewGuid(),
                    ContractId = contract.Id,
                    Amount = contract.EscrowAmount,
                    Type = "EscrowRefund",
                    Status = "Completed",
                    Reference = $"RFD-{Random.Shared.Next(100000, 999999)}"
                });
                break;
            case "PartialRefund":
                var refund = request.RefundAmount ?? contract.EscrowAmount * 0.5m;
                if (refund <= 0 || refund >= contract.EscrowAmount)
                    return BadRequest("Partial refund must be greater than 0 and less than escrow amount.");
                contract.EscrowStatus = "Refunded";
                contract.Status = "Cancelled";
                // Record partial refund
                _db.PaymentLedgers.Add(new PaymentLedger
                {
                    Id = Guid.NewGuid(),
                    ContractId = contract.Id,
                    Amount = refund,
                    Type = "EscrowRefund",
                    Status = "Completed",
                    Reference = $"RFD-{Random.Shared.Next(100000, 999999)}"
                });
                break;
            default:
                return BadRequest("Resolution must be 'ReleaseFunds', 'Refund', or 'PartialRefund'");
        }
        UpdateBuyerOrderStatusForContract(contract);

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "DISPUTE_RESOLVED",
            Actor = userId?.ToString() ?? "Admin",
            EntityType = "Contract",
            EntityId = contract.Id.ToString(),
            Metadata = $"{{\"resolution\":\"{request.Resolution}\"}}"
        });

        await _db.SaveChangesAsync();
        await NotifyContractParties(contract, "Dispute resolved", $"Dispute resolved: {request.Resolution}", "Info");

        return Ok(new
        {
            message = $"Dispute resolved: {request.Resolution}",
            status = contract.Status,
            escrowStatus = contract.EscrowStatus
        });
    }

    // ============================================================
    // GET /api/contracts/{id}/actions — Role-aware allowed actions
    // ============================================================
    [HttpGet("{id}/actions")]
    [Authorize]
    public async Task<IActionResult> GetAllowedActions(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");
        if (!await HasContractAccess(contract, userId.Value)) return Forbid();

        var isAdmin = User.IsInRole("Admin");
        var isBuyer = await IsAuthorizedForPartyAction(contract, "Buyer", userId.Value);
        var isSeller = await IsAuthorizedForPartyAction(contract, "Seller", userId.Value);
        var hasCompletedDelivery = await _db.TransportRequests
            .AnyAsync(t => t.ContractId == contract.Id && (t.Status == "Delivered" || t.Status == "Completed"));

        var actions = new
        {
            uploadBuyerDocument = (isBuyer || isAdmin) && !contract.BuyerSigned && !contract.SellerSigned,
            uploadSellerDocument = (isSeller || isAdmin) && !contract.BuyerSigned && !contract.SellerSigned,
            approveAsBuyer = (isBuyer || isAdmin) && !contract.BuyerSigned,
            approveAsSeller = (isSeller || isAdmin) && !contract.SellerSigned,
            requestBuyerSignature = (isBuyer || isAdmin) && !contract.BuyerSigned && contract.BuyerApproved && contract.SellerApproved && (contract.Status == "PendingSignature" || contract.Status == "Draft" || contract.Status == "PendingApproval"),
            requestSellerSignature = (isSeller || isAdmin) && !contract.SellerSigned && contract.BuyerApproved && contract.SellerApproved && (contract.Status == "PendingSignature" || contract.Status == "Draft" || contract.Status == "PendingApproval"),
            verifyBuyerSignature = (isBuyer || isAdmin) && !contract.BuyerSigned && !string.IsNullOrEmpty(contract.BuyerSignatureOtp),
            verifySellerSignature = (isSeller || isAdmin) && !contract.SellerSigned && !string.IsNullOrEmpty(contract.SellerSignatureOtp),
            fundEscrow = (isBuyer || isAdmin) && contract.Status == "Active" && contract.EscrowStatus == "None" && contract.BuyerSigned && contract.SellerSigned,
            releaseEscrow = (isBuyer || isAdmin) && contract.EscrowStatus == "Funded" && hasCompletedDelivery && contract.Status != "Disputed",
            raiseDispute = (isBuyer || isSeller || isAdmin) && (contract.Status == "Active" || contract.Status == "InDelivery"),
            resolveDispute = isAdmin && contract.Status == "Disputed"
        };

        return Ok(new
        {
            contractId = contract.Id,
            status = contract.Status,
            escrowStatus = contract.EscrowStatus,
            buyerApproved = contract.BuyerApproved,
            sellerApproved = contract.SellerApproved,
            hasCompletedDelivery,
            actions
        });
    }

    // ============================================================
    // GET /api/contracts/{id}/timeline — Contract lifecycle timeline
    // ============================================================
    [HttpGet("{id}/timeline")]
    [Authorize]
    public async Task<IActionResult> GetContractTimeline(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var contract = await LoadContractForPartyAuthorization(id);
        if (contract == null) return NotFound("Contract not found");

        var canView = await HasContractAccess(contract, userId.Value);
        if (!canView) return Forbid();

        var auditEvents = await _db.AuditLogs
            .Where(a => a.EntityType == "Contract" && a.EntityId == contract.Id.ToString())
            .OrderBy(a => a.Timestamp)
            .Select(a => new TimelineEvent(
                Type: "Audit",
                At: a.Timestamp,
                Action: a.Action,
                Actor: a.Actor,
                Metadata: a.Metadata,
                Amount: null,
                Status: null,
                Reference: null,
                Origin: null,
                Destination: null,
                TransporterId: null))
            .ToListAsync();

        var payments = await _db.PaymentLedgers
            .Where(p => p.ContractId == contract.Id)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new TimelineEvent(
                Type: "Payment",
                At: p.CreatedAt,
                Action: p.Type,
                Actor: null,
                Metadata: null,
                Amount: p.Amount,
                Status: p.Status,
                Reference: p.Reference,
                Origin: null,
                Destination: null,
                TransporterId: null))
            .ToListAsync();

        var deliveries = await _db.TransportRequests
            .Where(t => t.ContractId == contract.Id)
            .OrderBy(t => t.CreatedAt)
            .Select(t => new TimelineEvent(
                Type: "Delivery",
                At: t.DeliveredAt ?? t.PickedUpAt ?? t.AssignedAt ?? t.CreatedAt,
                Action: t.Status,
                Actor: null,
                Metadata: null,
                Amount: null,
                Status: null,
                Reference: null,
                Origin: t.Origin,
                Destination: t.Destination,
                TransporterId: t.TransporterId))
            .ToListAsync();

        var events = auditEvents
            .Concat(payments)
            .Concat(deliveries)
            .OrderBy(e => e.At)
            .ToList();

        return Ok(new
        {
            contractId = contract.Id,
            trackingId = contract.TrackingId,
            status = contract.Status,
            escrowStatus = contract.EscrowStatus,
            events
        });
    }

    private sealed record TimelineEvent(
        string Type,
        DateTime At,
        string Action,
        string? Actor,
        string? Metadata,
        decimal? Amount,
        string? Status,
        string? Reference,
        string? Origin,
        string? Destination,
        Guid? TransporterId);

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ??
                    User.FindFirst(JwtRegisteredClaimNames.Sub) ??
                    User.FindFirst("sub") ??
                    User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    private static void UpdateBuyerOrderStatusForContract(Contract contract)
    {
        if (contract.BuyerOrder == null) return;

        var next = contract.Status switch
        {
            "Completed" => "Completed",
            "Cancelled" => "Cancelled",
            _ => "Accepted"
        };

        contract.BuyerOrder.Status = next;
    }

    private async Task<Contract?> LoadContractForPartyAuthorization(Guid id)
    {
        return await _db.Contracts
            .Include(c => c.BuyerOrder)
                .ThenInclude(o => o.BuyerProfile)
            .Include(c => c.BuyerOrder)
                .ThenInclude(o => o.MarketListing)
                    .ThenInclude(l => l.Cooperative)
            .Include(c => c.ContractLots)
                .ThenInclude(cl => cl.Lot)
                    .ThenInclude(l => l.Cooperative)
            .Include(c => c.TransportRequests)
            .Include(c => c.StorageBookings)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    private async Task<bool> IsAuthorizedForPartyAction(Contract contract, string party, Guid userId)
    {
        if (User.IsInRole("Admin")) return true;

        if (party.Equals("Buyer", StringComparison.OrdinalIgnoreCase))
        {
            return contract.BuyerOrder?.BuyerProfile?.UserId == userId;
        }

        if (party.Equals("Seller", StringComparison.OrdinalIgnoreCase))
        {
            var cooperativeIds = new HashSet<Guid>();
            if (contract.BuyerOrder?.MarketListing?.CooperativeId is Guid listingCoopId)
                cooperativeIds.Add(listingCoopId);
            foreach (var lotCoopId in contract.ContractLots
                         .Where(cl => cl.Lot?.CooperativeId != null)
                         .Select(cl => cl.Lot.CooperativeId!.Value))
            {
                cooperativeIds.Add(lotCoopId);
            }

            if (cooperativeIds.Count > 0 && await _db.Cooperatives.AnyAsync(c => cooperativeIds.Contains(c.Id) && c.ManagerId == userId))
                return true;

            if (User.IsInRole("StorageOperator") || User.IsInRole("StorageManager"))
            {
                return contract.StorageBookings.Any(sb => sb.ContractId == contract.Id);
            }

            return false;
        }

        return false;
    }

    private async Task<bool> HasContractAccess(Contract contract, Guid userId)
    {
        if (User.IsInRole("Admin")) return true;
        if (User.IsInRole("Government")) return true; // Read-only oversight
        if (await IsAuthorizedForPartyAction(contract, "Buyer", userId)) return true;
        if (await IsAuthorizedForPartyAction(contract, "Seller", userId)) return true;

        if (User.IsInRole("Farmer"))
        {
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId);
            if (farmer?.CooperativeId is Guid cooperativeId)
            {
                var hasSameCooperative = contract.ContractLots.Any(cl => cl.Lot?.CooperativeId == cooperativeId) ||
                                         contract.BuyerOrder?.MarketListing?.CooperativeId == cooperativeId;
                if (hasSameCooperative) return true;
            }
        }

        if (User.IsInRole("Transporter"))
        {
            var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == userId);
            if (transporter != null && contract.TransportRequests.Any(t => t.TransporterId == transporter.Id))
                return true;
        }

        if (User.IsInRole("StorageOperator") || User.IsInRole("StorageManager"))
        {
            if (contract.StorageBookings.Any(sb => sb.ContractId == contract.Id))
                return true;
        }

        return false;
    }

    private static string BuildAutoContractDocument(BuyerOrder order, List<Lot> lots, decimal agreedPrice, double totalQuantity)
    {
        var lotsLines = string.Join(Environment.NewLine, lots.Select((l, i) =>
            $"{i + 1}. {l.Crop} - {l.QuantityKg:N0} kg - Grade {(string.IsNullOrWhiteSpace(l.QualityGrade) ? "Standard" : l.QualityGrade)}"));
        return
$@"RASS DIGITAL SUPPLY CONTRACT

Order Crop: {order.Crop}
Total Quantity: {totalQuantity:N0} kg
Agreed Unit Price: {agreedPrice:N0} RWF/kg
Total Contract Value: {(agreedPrice * (decimal)totalQuantity):N0} RWF

Lots Covered:
{lotsLines}

Delivery Terms:
Delivery within 7 days after both parties approve and sign the contract.

Payment Terms:
Escrow-funded payment. Buyer funds escrow after both signatures. Funds release after delivery confirmation.

Penalty Clause:
Delays or non-compliance may trigger dispute process and penalties as per platform policy.";
    }

    private async Task NotifyContractParties(Contract contract, string title, string message, string type)
    {
        var recipients = GetContractPartyUserIds(contract);
        if (recipients.Count == 0) return;
        var now = DateTime.UtcNow;
        var notifications = recipients.Select(userId => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            ActionUrl = $"/contracts?highlight={contract.Id}",
            CreatedAt = now
        }).ToList();

        _db.Notifications.AddRange(notifications);
        await _db.SaveChangesAsync();

        foreach (var note in notifications)
        {
            await _hubContext.Clients.Group($"user-{note.UserId}")
                .SendAsync("ReceiveNotification", new
                {
                    note.Id,
                    note.Title,
                    note.Message,
                    note.Type,
                    note.CreatedAt,
                    note.ActionUrl
                });
        }
    }

    private static HashSet<Guid> GetContractPartyUserIds(Contract contract)
    {
        var result = new HashSet<Guid>();
        if (contract.BuyerOrder?.BuyerProfile?.UserId is Guid buyerUserId)
            result.Add(buyerUserId);
        if (contract.BuyerOrder?.MarketListing?.Cooperative?.ManagerId is Guid listingManagerId)
            result.Add(listingManagerId);
        foreach (var managerId in contract.ContractLots
            .Select(cl => cl.Lot?.Cooperative?.ManagerId)
            .Where(mid => mid.HasValue)
            .Select(mid => mid!.Value))
            result.Add(managerId);

        return result;
    }
}
