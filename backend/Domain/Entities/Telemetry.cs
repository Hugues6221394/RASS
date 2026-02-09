namespace Rass.Api.Domain.Entities;

public class Telemetry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? StorageFacilityId { get; set; }
    public StorageFacility? StorageFacility { get; set; }
    public Guid? TransportRequestId { get; set; }
    public TransportRequest? TransportRequest { get; set; }
    public DateTime RecordedAt { get; set; }
    public double TemperatureC { get; set; }
    public double Humidity { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

