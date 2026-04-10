using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Services;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/platform")]
public class PlatformController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ForecastingService _forecastingService;

    public PlatformController(AppDbContext db, ForecastingService forecastingService)
    {
        _db = db;
        _forecastingService = forecastingService;
    }

    [HttpGet("health")]
    [AllowAnonymous]
    public async Task<IActionResult> GetHealth()
    {
        var dbHealthy = await _db.Database.CanConnectAsync();
        var forecastingHealthy = await _forecastingService.IsHealthyAsync();

        var totalUsers = await _db.Users.CountAsync();
        var activeListings = await _db.MarketListings.CountAsync(l => l.Status == "Active");
        var openOrders = await _db.BuyerOrders.CountAsync(o => o.Status == "Open");

        var status = dbHealthy && forecastingHealthy ? "Healthy" : "Degraded";
        return Ok(new
        {
            status,
            timestampUtc = DateTime.UtcNow,
            services = new
            {
                database = dbHealthy ? "Up" : "Down",
                forecasting = forecastingHealthy ? "Up" : "Down"
            },
            kpis = new
            {
                totalUsers,
                activeListings,
                openOrders
            }
        });
    }
}

