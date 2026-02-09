using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public PaymentsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost("settle-farmer-payments")]
    [Authorize(Roles = "CooperativeManager,Admin")]
    public async Task<IActionResult> SettleFarmerPayments(SettleFarmerPaymentsRequest request)
    {
        var contract = await _db.Contracts
            .Include(c => c.ContractLots)
            .ThenInclude(cl => cl.Lot)
            .ThenInclude(l => l.Farmer)
            .FirstOrDefaultAsync(c => c.Id == request.ContractId);

        if (contract == null) return NotFound("Contract not found");

        var payment = await _db.PaymentLedgers
            .FirstOrDefaultAsync(p => p.ContractId == contract.Id && p.Type == "Escrow" && p.Status == "Completed");
        if (payment == null) return BadRequest("No completed payment found for this contract");

        // Calculate farmer shares based on their lot contributions
        var farmerShares = contract.ContractLots
            .Where(cl => cl.Lot.FarmerId.HasValue)
            .GroupBy(cl => cl.Lot.FarmerId)
            .Select(g => new
            {
                FarmerId = g.Key!.Value,
                Quantity = g.Sum(cl => cl.Lot.QuantityKg),
                TotalQuantity = contract.ContractLots.Sum(cl => cl.Lot.QuantityKg)
            })
            .ToList();

        var totalAmount = payment.Amount;
        var farmerPayments = new List<FarmerBalance>();

        foreach (var share in farmerShares)
        {
            var farmerAmount = totalAmount * (decimal)(share.Quantity / share.TotalQuantity);

            var farmerBalance = new FarmerBalance
            {
                Id = Guid.NewGuid(),
                FarmerId = share.FarmerId,
                ContractId = contract.Id,
                Amount = farmerAmount,
                Status = "Pending",
                PaymentMethod = request.PaymentMethod,
                TransactionReference = $"FARMER-{share.FarmerId}-{DateTime.UtcNow:yyyyMMddHHmmss}"
            };

            farmerPayments.Add(farmerBalance);
        }

        _db.FarmerBalances.AddRange(farmerPayments);
        await _db.SaveChangesAsync();

        // Initiate mobile money transfers (mock implementation)
        foreach (var farmerPayment in farmerPayments)
        {
            var farmer = await _db.Farmers
                .Include(f => f.User)
                .FirstOrDefaultAsync(f => f.Id == farmerPayment.FarmerId);

            if (farmer != null)
            {
                // In real implementation, call mobile money API
                await InitiateMobileMoneyTransfer(farmer.Phone, farmerPayment.Amount, farmerPayment.TransactionReference);
                
                farmerPayment.Status = "Paid";
                farmerPayment.PaidAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            Message = "Farmer payments settled successfully",
            TotalFarmers = farmerPayments.Count,
            TotalAmount = totalAmount,
            Payments = farmerPayments.Select(p => new
            {
                p.Id,
                p.Amount,
                p.Status,
                p.TransactionReference
            })
        });
    }

    [HttpGet("farmer-balances")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> GetFarmerBalances()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
        if (farmer == null) return NotFound("Farmer not found");

        var balances = await _db.FarmerBalances
            .Include(b => b.Contract)
            .ThenInclude(c => c.BuyerOrder)
            .Where(b => b.FarmerId == farmer.Id)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.Amount,
                b.Status,
                b.PaymentMethod,
                b.TransactionReference,
                b.CreatedAt,
                b.PaidAt,
                Contract = new
                {
                    b.Contract.Id,
                    b.Contract.TrackingId,
                    Crop = b.Contract.BuyerOrder.Crop
                }
            })
            .ToListAsync();

        var summary = new
        {
            TotalPending = balances.Where(b => b.Status == "Pending").Sum(b => b.Amount),
            TotalPaid = balances.Where(b => b.Status == "Paid").Sum(b => b.Amount),
            TotalFailed = balances.Where(b => b.Status == "Failed").Sum(b => b.Amount),
            Transactions = balances
        };

        return Ok(summary);
    }

    [HttpGet("price-trends")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPriceTrends([FromQuery] string crop, [FromQuery] int days = 30)
    {
        var cutoff = DateTime.UtcNow.AddDays(-days);
        
        var prices = await _db.MarketPrices
            .Where(p => p.Crop == crop && p.ObservedAt >= cutoff)
            .OrderBy(p => p.ObservedAt)
            .GroupBy(p => p.Market)
            .Select(g => new
            {
                Market = g.Key,
                Prices = g.Select(p => new
                {
                    p.PricePerKg,
                    p.ObservedAt
                }).ToList(),
                CurrentPrice = g.OrderByDescending(p => p.ObservedAt).First().PricePerKg,
                PreviousPrice = g.OrderByDescending(p => p.ObservedAt).Skip(1).FirstOrDefault() != null
                    ? g.OrderByDescending(p => p.ObservedAt).Skip(1).First().PricePerKg
                    : (decimal?)null,
                Trend = g.OrderByDescending(p => p.ObservedAt).Count() > 1 &&
                    g.OrderByDescending(p => p.ObservedAt).First().PricePerKg >
                    g.OrderByDescending(p => p.ObservedAt).Skip(1).First().PricePerKg
                    ? "Up" : "Down"
            })
            .ToListAsync();

        var bestMarket = prices
            .OrderByDescending(p => p.CurrentPrice)
            .FirstOrDefault();

        return Ok(new
        {
            Crop = crop,
            Period = $"{days} days",
            Markets = prices,
            BestMarket = bestMarket != null ? new
            {
                bestMarket.Market,
                bestMarket.CurrentPrice,
                bestMarket.Trend
            } : null
        });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    private async Task InitiateMobileMoneyTransfer(string phone, decimal amount, string reference)
    {
        // Mock implementation - in production, integrate with MTN Mobile Money or Airtel Money API
        Console.WriteLine($"Mobile Money Transfer: {phone} - {amount} RWF - Ref: {reference}");
        
        // Simulate API call delay
        await Task.Delay(100);
    }
}

