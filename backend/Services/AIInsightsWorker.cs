using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace Rass.Api.Services;

/// <summary>
/// Background worker that periodically runs the AI Insights platform scan.
/// </summary>
public class AIInsightsWorker : BackgroundService
{
    private readonly ILogger<AIInsightsWorker> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(6); // Run every 6 hours

    public AIInsightsWorker(ILogger<AIInsightsWorker> logger, IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("AI Insights Background Worker starting.");

        // Optional: Wait an initial period before first scan to allow system startup
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("AI Insights Background Worker is triggering a platform scan at: {time}", DateTimeOffset.Now);

                using (var scope = _serviceProvider.CreateScope())
                {
                    var scopedInsightsService = scope.ServiceProvider.GetRequiredService<AIInsightsService>();
                    
                    // Trigger the full platform scan
                    var result = await scopedInsightsService.ScanPlatformAsync();
                    
                    _logger.LogInformation("Automated AI Scan completed. Found {Anomalies} anomalies, generated {Recommendations} recommendations, Action Required: {ActionRequired}", 
                        result.AnomaliesDetected, result.RecommendationsGenerated, result.RequiresAction);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while running the automated AI Insights scan.");
            }

            // Wait until next scheduled run
            await Task.Delay(_checkInterval, stoppingToken);
        }
        
        _logger.LogInformation("AI Insights Background Worker is stopping.");
    }
}
