using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

/// <summary>
/// Inter-cooperative crop sharing system.
/// Enables cooperatives to request scarce crops from other cooperatives
/// with surplus, creating balanced regional supply chains.
/// </summary>
[ApiController]
[Route("api/crop-sharing")]
[Authorize]
public class CropSharingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<Rass.Api.Hubs.NotificationHub> _hubContext;

    public CropSharingController(AppDbContext db, IHubContext<Rass.Api.Hubs.NotificationHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Detect regional supply imbalances — shows which crops are scarce vs surplus by region
    /// </summary>
    [HttpGet("supply-balance")]
    [Authorize(Roles = "CooperativeManager,Government,Admin")]
    public async Task<IActionResult> GetSupplyBalance()
    {
        var activeLots = await _db.Lots
            .Where(l => l.Status == "Stored" || l.Status == "Listed")
            .Include(l => l.Cooperative)
            .ToListAsync();

        var demand = await _db.BuyerOrders
            .Where(o => o.Status == "Open" || o.Status == "Accepted")
            .ToListAsync();

        var supplyByRegionCrop = activeLots
            .GroupBy(l => new { l.Cooperative?.Region, l.Crop })
            .Select(g => new
            {
                Region = g.Key.Region ?? "Unknown",
                Crop = g.Key.Crop,
                SupplyKg = g.Sum(l => l.QuantityKg),
                CooperativeCount = g.Select(l => l.CooperativeId).Distinct().Count(),
            })
            .ToList();

        var demandByCrop = demand
            .GroupBy(o => o.Crop)
            .ToDictionary(g => g.Key, g => g.Sum(o => o.QuantityKg));

        var balance = supplyByRegionCrop.Select(s =>
        {
            var nationalDemand = demandByCrop.GetValueOrDefault(s.Crop, 0);
            var ratio = nationalDemand > 0 ? s.SupplyKg / nationalDemand : 2.0;
            return new
            {
                s.Region,
                s.Crop,
                s.SupplyKg,
                NationalDemandKg = nationalDemand,
                s.CooperativeCount,
                SupplyRatio = Math.Round(ratio, 2),
                Status = ratio > 1.5 ? "Surplus" : ratio < 0.7 ? "Scarcity" : "Balanced",
            };
        })
        .OrderBy(b => b.Status == "Scarcity" ? 0 : b.Status == "Balanced" ? 1 : 2)
        .ThenBy(b => b.Region)
        .ToList();

        return Ok(balance);
    }

    /// <summary>
    /// Get potential suppliers for a specific crop (cooperatives with surplus)
    /// </summary>
    [HttpGet("potential-suppliers")]
    [Authorize(Roles = "CooperativeManager,Admin")]
    public async Task<IActionResult> GetPotentialSuppliers([FromQuery] string crop, [FromQuery] double minQuantityKg = 0)
    {
        var suppliers = await _db.Lots
            .Where(l => l.Crop == crop && (l.Status == "Stored" || l.Status == "Listed"))
            .Include(l => l.Cooperative)
            .GroupBy(l => l.Cooperative!)
            .Select(g => new
            {
                CooperativeId = g.Key.Id,
                CooperativeName = g.Key.Name,
                Region = g.Key.Region,
                District = g.Key.District,
                AvailableKg = g.Sum(l => l.QuantityKg),
            })
            .Where(s => s.AvailableKg > minQuantityKg)
            .OrderByDescending(s => s.AvailableKg)
            .ToListAsync();

        return Ok(suppliers);
    }

    /// <summary>
    /// Create a crop sharing request (cooperative needing crops)
    /// </summary>
    [HttpPost("requests")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> CreateRequest(CreateCropShareRequestDto request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        if (request.QuantityKg <= 0)
            return BadRequest("Quantity must be greater than zero.");
        if (!request.BroadcastToAll && !request.TargetCooperativeId.HasValue)
            return BadRequest("Select a target cooperative or choose broadcast to all.");

        if (request.TargetCooperativeId.HasValue)
        {
            var targetExists = await _db.Cooperatives.AnyAsync(c => c.Id == request.TargetCooperativeId.Value && c.IsActive);
            if (!targetExists) return BadRequest("Selected target cooperative was not found.");
            if (request.TargetCooperativeId.Value == cooperative.Id) return BadRequest("You cannot target your own cooperative.");
        }

        var shareRequest = new CropShareRequest
        {
            RequesterCooperativeId = cooperative.Id,
            Crop = request.Crop.Trim(),
            QuantityKg = request.QuantityKg,
            OfferedPricePerKg = request.OfferedPricePerKg,
            UrgencyLevel = request.UrgencyLevel ?? "Medium",
            Notes = request.Notes,
            Status = "Pending",
            BroadcastToAll = request.BroadcastToAll,
            TargetCooperativeId = request.BroadcastToAll ? null : request.TargetCooperativeId,
        };

        _db.CropShareRequests.Add(shareRequest);
        await _db.SaveChangesAsync();

        await NotifyPotentialSuppliers(shareRequest, cooperative.Name);

        return Created("", new { shareRequest.Id, message = "Crop sharing request created successfully" });
    }

    /// <summary>
    /// Get all open crop sharing requests (for cooperatives that might supply)
    /// </summary>
    [HttpGet("requests")]
    [Authorize(Roles = "CooperativeManager,Government,Admin")]
    public async Task<IActionResult> GetRequests(
        [FromQuery] string? crop = null,
        [FromQuery] string? status = null)
    {
        var query = _db.CropShareRequests
            .Include(r => r.RequesterCooperative)
            .Include(r => r.SupplierCooperative)
            .Include(r => r.TargetCooperative)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(crop))
            query = query.Where(r => r.Crop == crop);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(r => r.Status == status);
        else
            query = query.Where(r => r.Status != "Cancelled");

        var requests = await query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id, r.Crop, r.QuantityKg, r.OfferedPricePerKg,
                r.UrgencyLevel, r.Status, r.Notes,
                r.AgreedPricePerKg, r.AgreedQuantityKg, r.DeliveryTerms,
                r.ResponseNotes, r.CreatedAt, r.RespondedAt, r.FulfilledAt,
                Requester = r.RequesterCooperative == null ? null : new
                {
                    r.RequesterCooperative.Id,
                    r.RequesterCooperative.Name,
                    r.RequesterCooperative.Region,
                    r.RequesterCooperative.District,
                },
                Supplier = r.SupplierCooperative == null ? null : new
                {
                    r.SupplierCooperative.Id,
                    r.SupplierCooperative.Name,
                    r.SupplierCooperative.Region,
                    r.SupplierCooperative.District,
                },
                Target = r.TargetCooperative == null ? null : new
                {
                    r.TargetCooperative.Id,
                    r.TargetCooperative.Name,
                    r.TargetCooperative.Region,
                    r.TargetCooperative.District,
                },
                r.BroadcastToAll,
            })
            .ToListAsync();

        return Ok(requests);
    }

    /// <summary>
    /// My cooperative's requests (sent and received)
    /// </summary>
    [HttpGet("my-requests")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetMyRequests()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var sentRows = await _db.CropShareRequests
            .Include(r => r.SupplierCooperative)
            .Include(r => r.TargetCooperative)
            .Where(r => r.RequesterCooperativeId == cooperative.Id)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var sentRequestIds = sentRows.Select(r => r.Id).ToList();
        var sentBidStats = await _db.CropShareBids
            .Where(b => sentRequestIds.Contains(b.CropShareRequestId))
            .GroupBy(b => b.CropShareRequestId)
            .Select(g => new
            {
                RequestId = g.Key,
                TotalBids = g.Count(),
                PendingBids = g.Count(b => b.Status == "Pending"),
                SelectedBids = g.Count(b => b.Status == "Selected"),
            })
            .ToDictionaryAsync(x => x.RequestId, x => x);

        var sent = sentRows.Select(r =>
        {
            sentBidStats.TryGetValue(r.Id, out var bidStat);
            return new
            {
                r.Id,
                r.Crop,
                r.QuantityKg,
                r.OfferedPricePerKg,
                r.UrgencyLevel,
                r.Status,
                r.Notes,
                r.AgreedPricePerKg,
                r.AgreedQuantityKg,
                r.DeliveryTerms,
                r.ResponseNotes,
                r.CreatedAt,
                r.RespondedAt,
                r.BroadcastToAll,
                BidCount = bidStat?.TotalBids ?? 0,
                PendingBidCount = bidStat?.PendingBids ?? 0,
                HasSelectedBid = (bidStat?.SelectedBids ?? 0) > 0,
                Target = r.TargetCooperative == null ? null : new { r.TargetCooperative.Id, r.TargetCooperative.Name, r.TargetCooperative.Region },
                Direction = "Sent",
                Partner = r.SupplierCooperative == null ? null : new { r.SupplierCooperative.Name, r.SupplierCooperative.Region },
            };
        }).ToList();

        var received = await _db.CropShareRequests
            .Include(r => r.RequesterCooperative)
            .Where(r => r.SupplierCooperativeId == cooperative.Id || (r.SupplierCooperativeId == null && r.Status == "Open" && (r.BroadcastToAll || r.TargetCooperativeId == cooperative.Id)))
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id, r.Crop, r.QuantityKg, r.OfferedPricePerKg,
                r.UrgencyLevel, r.Status, r.Notes,
                r.AgreedPricePerKg, r.AgreedQuantityKg, r.DeliveryTerms,
                r.ResponseNotes, r.CreatedAt, r.RespondedAt,
                r.BroadcastToAll,
                Direction = "Received",
                Partner = r.RequesterCooperative == null ? null : new { r.RequesterCooperative.Name, r.RequesterCooperative.Region },
            })
            .ToListAsync();

        var submittedBids = await _db.CropShareBids
            .Include(b => b.CropShareRequest)
            .ThenInclude(r => r!.RequesterCooperative)
            .Where(b => b.SupplierCooperativeId == cooperative.Id)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.CropShareRequestId,
                b.ProposedPricePerKg,
                b.ProposedQuantityKg,
                b.DeliveryTerms,
                b.Notes,
                b.Status,
                b.CreatedAt,
                Request = b.CropShareRequest == null ? null : new
                {
                    b.CropShareRequest.Crop,
                    b.CropShareRequest.QuantityKg,
                    b.CropShareRequest.UrgencyLevel,
                    b.CropShareRequest.Status,
                    Requester = b.CropShareRequest.RequesterCooperative == null ? null : new
                    {
                        b.CropShareRequest.RequesterCooperative.Name,
                        b.CropShareRequest.RequesterCooperative.Region,
                    }
                }
            })
            .ToListAsync();

        var incomingBids = await _db.CropShareBids
            .Include(b => b.SupplierCooperative)
            .Include(b => b.CropShareRequest)
            .Where(b => b.CropShareRequest != null &&
                        b.CropShareRequest.RequesterCooperativeId == cooperative.Id)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.CropShareRequestId,
                b.ProposedPricePerKg,
                b.ProposedQuantityKg,
                b.DeliveryTerms,
                b.Notes,
                b.Status,
                b.CreatedAt,
                Supplier = b.SupplierCooperative == null ? null : new
                {
                    b.SupplierCooperative.Id,
                    b.SupplierCooperative.Name,
                    b.SupplierCooperative.Region,
                    b.SupplierCooperative.District,
                }
            })
            .ToListAsync();

        return Ok(new { sent, received, submittedBids, incomingBids });
    }

    /// <summary>
    /// Respond to a crop sharing request (accept or decline as a supplier)
    /// </summary>
    [HttpPost("requests/{id}/respond")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> RespondToRequest(Guid id, RespondToCropShareRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var shareRequest = await _db.CropShareRequests.FindAsync(id);
        if (shareRequest == null) return NotFound("Crop sharing request not found");

        if (shareRequest.RequesterCooperativeId == cooperative.Id)
            return BadRequest("You cannot respond to your own request.");
        if (!shareRequest.BroadcastToAll && shareRequest.TargetCooperativeId.HasValue && shareRequest.TargetCooperativeId != cooperative.Id)
            return Forbid("This request is targeted to a different cooperative.");
        if (shareRequest.SupplierCooperativeId.HasValue && shareRequest.SupplierCooperativeId != cooperative.Id && request.Accepted)
            return BadRequest("This request is already contracted with another supplier.");

        if (shareRequest.Status != "Open" && shareRequest.Status != "Pending" && shareRequest.Status != "Matched")
            return BadRequest("This request is no longer open for responses.");

        if (request.Accepted)
        {
            // Verify supplier has enough inventory
            var available = await _db.Lots
                .Where(l => l.CooperativeId == cooperative.Id &&
                            l.Crop == shareRequest.Crop &&
                            (l.Status == "Stored" || l.Status == "Listed"))
                .SumAsync(l => l.QuantityKg);

            var agreedQty = request.AgreedQuantityKg ?? shareRequest.QuantityKg;
            if (available < agreedQty)
                return BadRequest($"Insufficient inventory. Available: {available:N0} kg, requested: {agreedQty:N0} kg.");

            shareRequest.SupplierCooperativeId = cooperative.Id;
            shareRequest.AgreedPricePerKg = request.AgreedPricePerKg ?? shareRequest.OfferedPricePerKg;
            shareRequest.AgreedQuantityKg = agreedQty;
            shareRequest.DeliveryTerms = string.IsNullOrWhiteSpace(request.DeliveryTerms)
                ? "Delivery expected within 72 hours of acceptance."
                : request.DeliveryTerms;
            shareRequest.ResponseNotes = request.ResponseNotes;
            shareRequest.Status = "Accepted";
            shareRequest.RespondedAt = DateTime.UtcNow;

            await NotifyRequesterOfContract(shareRequest, cooperative.Name);
        }
        else
        {
            shareRequest.ResponseNotes = request.ResponseNotes;
            // Don't change status — leave open for other suppliers
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            shareRequest.Id,
            shareRequest.Status,
            message = request.Accepted
                ? "Crop sharing agreement created successfully"
                : "Response recorded"
        });
    }

    [HttpPost("requests/{id}/bids")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> SubmitBid(Guid id, SubmitCropShareBidRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var shareRequest = await _db.CropShareRequests.FindAsync(id);
        if (shareRequest == null) return NotFound("Crop sharing request not found");
        if (shareRequest.RequesterCooperativeId == cooperative.Id) return BadRequest("You cannot bid on your own request.");
        if (!shareRequest.BroadcastToAll && shareRequest.TargetCooperativeId.HasValue && shareRequest.TargetCooperativeId != cooperative.Id)
            return Forbid("This request is targeted to another cooperative.");
        if (shareRequest.Status != "Open" && shareRequest.Status != "Pending" && shareRequest.Status != "Matched")
            return BadRequest("This request is no longer open for bidding.");
        if (request.ProposedPricePerKg <= 0) return BadRequest("Proposed price must be greater than zero.");
        if (request.ProposedQuantityKg <= 0) return BadRequest("Proposed quantity must be greater than zero.");

        var available = await _db.Lots
            .Where(l => l.CooperativeId == cooperative.Id &&
                        l.Crop == shareRequest.Crop &&
                        (l.Status == "Stored" || l.Status == "Listed"))
            .SumAsync(l => l.QuantityKg);
        if (available < request.ProposedQuantityKg)
            return BadRequest($"Insufficient inventory. Available: {available:N0} kg, bid: {request.ProposedQuantityKg:N0} kg.");

        var existingBid = await _db.CropShareBids
            .FirstOrDefaultAsync(b => b.CropShareRequestId == id && b.SupplierCooperativeId == cooperative.Id);

        if (existingBid != null && existingBid.Status == "Selected")
            return BadRequest("Your bid for this request was already selected.");

        if (existingBid == null)
        {
            existingBid = new CropShareBid
            {
                CropShareRequestId = id,
                SupplierCooperativeId = cooperative.Id,
                ProposedPricePerKg = request.ProposedPricePerKg,
                ProposedQuantityKg = request.ProposedQuantityKg,
                DeliveryTerms = request.DeliveryTerms,
                Notes = request.Notes,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow,
            };
            _db.CropShareBids.Add(existingBid);
        }
        else
        {
            existingBid.ProposedPricePerKg = request.ProposedPricePerKg;
            existingBid.ProposedQuantityKg = request.ProposedQuantityKg;
            existingBid.DeliveryTerms = request.DeliveryTerms;
            existingBid.Notes = request.Notes;
            existingBid.Status = "Pending";
            existingBid.UpdatedAt = DateTime.UtcNow;
        }

        if (shareRequest.Status == "Pending") shareRequest.Status = "Open";

        await _db.SaveChangesAsync();
        await NotifyRequesterOfNewBid(shareRequest, cooperative.Name, request.ProposedPricePerKg, request.ProposedQuantityKg);

        return Ok(new { existingBid.Id, existingBid.Status, message = "Bid submitted successfully." });
    }

    [HttpGet("requests/{id}/bids")]
    [Authorize(Roles = "CooperativeManager,Government,Admin")]
    public async Task<IActionResult> GetRequestBids(Guid id)
    {
        var bids = await _db.CropShareBids
            .Include(b => b.SupplierCooperative)
            .Where(b => b.CropShareRequestId == id)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.CropShareRequestId,
                b.ProposedPricePerKg,
                b.ProposedQuantityKg,
                b.DeliveryTerms,
                b.Notes,
                b.Status,
                b.CreatedAt,
                Supplier = b.SupplierCooperative == null ? null : new
                {
                    b.SupplierCooperative.Id,
                    b.SupplierCooperative.Name,
                    b.SupplierCooperative.Region,
                    b.SupplierCooperative.District,
                }
            })
            .ToListAsync();

        return Ok(bids);
    }

    [HttpPost("requests/{id}/select-bid")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> SelectBid(Guid id, SelectCropShareBidRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var shareRequest = await _db.CropShareRequests
            .Include(r => r.Bids)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (shareRequest == null) return NotFound("Crop sharing request not found");
        if (shareRequest.RequesterCooperativeId != cooperative.Id) return Forbid("Only requester can select a bid.");
        if (shareRequest.Status == "Completed" || shareRequest.Status == "Cancelled")
            return BadRequest("This request is closed.");

        var selectedBid = shareRequest.Bids.FirstOrDefault(b => b.Id == request.BidId);
        if (selectedBid == null) return BadRequest("Selected bid does not belong to this request.");
        if (selectedBid.Status != "Pending") return BadRequest("Only pending bids can be selected.");

        var selectedSupplier = await _db.Cooperatives.FindAsync(selectedBid.SupplierCooperativeId);
        if (selectedSupplier == null) return BadRequest("Selected supplier cooperative was not found.");

        foreach (var bid in shareRequest.Bids)
        {
            bid.Status = bid.Id == selectedBid.Id ? "Selected" : "Rejected";
            bid.UpdatedAt = DateTime.UtcNow;
        }

        shareRequest.SupplierCooperativeId = selectedBid.SupplierCooperativeId;
        shareRequest.AgreedPricePerKg = selectedBid.ProposedPricePerKg;
        shareRequest.AgreedQuantityKg = selectedBid.ProposedQuantityKg;
        shareRequest.DeliveryTerms = string.IsNullOrWhiteSpace(selectedBid.DeliveryTerms)
            ? "Delivery expected within 72 hours of selection."
            : selectedBid.DeliveryTerms;
        shareRequest.ResponseNotes = selectedBid.Notes;
        shareRequest.Status = "Accepted";
        shareRequest.RespondedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await NotifyBidSelectionResults(shareRequest, selectedBid.Id, selectedSupplier.Name);

        return Ok(new { shareRequest.Id, shareRequest.Status, message = "Bid selected and contract activated." });
    }

    /// <summary>
    /// Mark a request as fulfilled
    /// </summary>
    [HttpPost("requests/{id}/fulfill")]
    [Authorize(Roles = "CooperativeManager,Admin")]
    public async Task<IActionResult> FulfillRequest(Guid id)
    {
        var shareRequest = await _db.CropShareRequests.FindAsync(id);
        if (shareRequest == null) return NotFound();

        if (shareRequest.Status != "Contracted" && shareRequest.Status != "Accepted")
            return BadRequest("Only accepted requests can be fulfilled.");

        shareRequest.Status = "Completed";
        shareRequest.FulfilledAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Crop sharing request marked as fulfilled" });
    }

    /// <summary>
    /// Cancel a request (only by requester, only if still Open)
    /// </summary>
    [HttpPost("requests/{id}/cancel")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> CancelRequest(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var shareRequest = await _db.CropShareRequests.FindAsync(id);
        if (shareRequest == null) return NotFound();

        if (shareRequest.RequesterCooperativeId != cooperative.Id)
            return Forbid("You can only cancel your own requests.");
        if (shareRequest.Status != "Open" && shareRequest.Status != "Pending")
            return BadRequest("Only pending requests can be cancelled.");

        shareRequest.Status = "Cancelled";
        await _db.SaveChangesAsync();

        return Ok(new { message = "Request cancelled" });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ??
                    User.FindFirst("sub") ??
                    User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    private async Task NotifyPotentialSuppliers(CropShareRequest shareRequest, string requesterName)
    {
        var candidateCoops = await _db.Cooperatives
            .Where(c => c.IsActive && c.ManagerId != null && c.Id != shareRequest.RequesterCooperativeId)
            .Where(c => shareRequest.BroadcastToAll || c.Id == shareRequest.TargetCooperativeId)
            .Select(c => new { c.Id, c.ManagerId, c.Name })
            .ToListAsync();

        var managerIds = candidateCoops.Where(c => c.ManagerId.HasValue).Select(c => c.ManagerId!.Value).ToList();
        if (managerIds.Count == 0) return;

        var notes = managerIds.Select(userId => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = "New crop sharing request",
            Message = $"{requesterName} requested {shareRequest.QuantityKg:N0} kg of {shareRequest.Crop}. Review and bid from Crop Sharing.",
            Type = "Info",
            ActionUrl = "/cooperative-dashboard?tab=crop-sharing",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _db.Notifications.AddRange(notes);
        await _db.SaveChangesAsync();

        foreach (var note in notes)
        {
            await _hubContext.Clients.Group($"user-{note.UserId}").SendAsync("ReceiveNotification", new
            {
                note.Id,
                note.Title,
                note.Message,
                note.Type,
                note.IsRead,
                note.CreatedAt,
                note.ActionUrl
            });
        }
    }

    private async Task NotifyRequesterOfContract(CropShareRequest shareRequest, string supplierName)
    {
        var requesterManagerId = await _db.Cooperatives
            .Where(c => c.Id == shareRequest.RequesterCooperativeId)
            .Select(c => c.ManagerId)
            .FirstOrDefaultAsync();
        if (!requesterManagerId.HasValue) return;

        var note = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = requesterManagerId.Value,
            Title = "Crop sharing request contracted",
            Message = $"{supplierName} accepted your {shareRequest.Crop} request. Agreement terms are now active.",
            Type = "Success",
            ActionUrl = "/cooperative-dashboard?tab=crop-sharing",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.Notifications.Add(note);
        await _db.SaveChangesAsync();
        await _hubContext.Clients.Group($"user-{note.UserId}").SendAsync("ReceiveNotification", new
        {
            note.Id,
            note.Title,
            note.Message,
            note.Type,
            note.IsRead,
            note.CreatedAt,
            note.ActionUrl
        });
    }

    private async Task NotifyRequesterOfNewBid(CropShareRequest shareRequest, string supplierName, decimal price, double quantityKg)
    {
        var requesterManagerId = await _db.Cooperatives
            .Where(c => c.Id == shareRequest.RequesterCooperativeId)
            .Select(c => c.ManagerId)
            .FirstOrDefaultAsync();
        if (!requesterManagerId.HasValue) return;

        var note = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = requesterManagerId.Value,
            Title = "New crop sharing bid received",
            Message = $"{supplierName} submitted a bid: {price:N0} RWF/kg for {quantityKg:N0} kg of {shareRequest.Crop}.",
            Type = "Info",
            ActionUrl = "/cooperative-dashboard?tab=crop-sharing",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.Notifications.Add(note);
        await _db.SaveChangesAsync();
        await _hubContext.Clients.Group($"user-{note.UserId}").SendAsync("ReceiveNotification", new
        {
            note.Id,
            note.Title,
            note.Message,
            note.Type,
            note.IsRead,
            note.CreatedAt,
            note.ActionUrl
        });
    }

    private async Task NotifyBidSelectionResults(CropShareRequest shareRequest, Guid selectedBidId, string selectedSupplierName)
    {
        var bidRecipients = await _db.CropShareBids
            .Where(b => b.CropShareRequestId == shareRequest.Id)
            .Join(_db.Cooperatives,
                bid => bid.SupplierCooperativeId,
                coop => coop.Id,
                (bid, coop) => new { bid.Id, bid.Status, coop.ManagerId, coop.Name })
            .Where(x => x.ManagerId.HasValue)
            .ToListAsync();

        if (bidRecipients.Count == 0) return;

        var notes = bidRecipients.Select(r => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = r.ManagerId!.Value,
            Title = r.Id == selectedBidId ? "Crop sharing bid selected" : "Crop sharing bid not selected",
            Message = r.Id == selectedBidId
                ? $"Your bid was selected for {shareRequest.Crop}. Proceed with agreed delivery terms."
                : $"{selectedSupplierName} was selected for {shareRequest.Crop}. Keep engaging for next opportunities.",
            Type = r.Id == selectedBidId ? "Success" : "Info",
            ActionUrl = "/cooperative-dashboard?tab=crop-sharing",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _db.Notifications.AddRange(notes);
        await _db.SaveChangesAsync();

        foreach (var note in notes)
        {
            await _hubContext.Clients.Group($"user-{note.UserId}").SendAsync("ReceiveNotification", new
            {
                note.Id,
                note.Title,
                note.Message,
                note.Type,
                note.IsRead,
                note.CreatedAt,
                note.ActionUrl
            });
        }
    }
}
