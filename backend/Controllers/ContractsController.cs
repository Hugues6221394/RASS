using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ContractsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ContractsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetContracts()
    {
        var contracts = await _db.Contracts
            .Include(c => c.BuyerOrder).ThenInclude(o => o.BuyerProfile).ThenInclude(b => b.User)
            .Include(c => c.ContractLots).ThenInclude(cl => cl.Lot)
            .Select(c => new
            {
                c.Id,
                c.BuyerOrderId,
                c.AgreedPrice,
                c.Status,
                c.TrackingId,
                Buyer = c.BuyerOrder.BuyerProfile.User.FullName,
                Lots = c.ContractLots.Select(l => new { l.LotId, l.Lot.Crop, l.Lot.QuantityKg })
            }).ToListAsync();

        return Ok(contracts);
    }

    [HttpPost]
    [Authorize(Roles = "Buyer,CooperativeManager,Admin")]
    public async Task<IActionResult> CreateContract(CreateContractRequest request)
    {
        var order = await _db.BuyerOrders.FirstOrDefaultAsync(o => o.Id == request.BuyerOrderId);
        if (order == null)
        {
            return NotFound("Order not found.");
        }

        var lots = await _db.Lots.Where(l => request.LotIds.Contains(l.Id)).ToListAsync();
        if (!lots.Any())
        {
            return BadRequest("No valid lots provided.");
        }

        var contract = new Contract
        {
            Id = Guid.NewGuid(),
            BuyerOrderId = order.Id,
            AgreedPrice = request.AgreedPrice > 0 ? request.AgreedPrice : order.PriceOffer,
            Status = "Active",
            TrackingId = $"RASS-{Random.Shared.Next(100000, 999999)}"
        };

        foreach (var lot in lots)
        {
            contract.ContractLots.Add(new ContractLot
            {
                ContractId = contract.Id,
                LotId = lot.Id
            });
        }

        _db.Contracts.Add(contract);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetContracts), new { id = contract.Id }, contract);
    }
}

