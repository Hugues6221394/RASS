using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class Farmer
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    public Guid? CooperativeId { get; set; }
    public Cooperative? Cooperative { get; set; }

    [MaxLength(100)]
    public string District { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Sector { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(20)]
    public string NationalId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Crops { get; set; } = string.Empty;

    public double FarmSizeHectares { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Lot> Lots { get; set; } = new List<Lot>();

    public ICollection<HarvestDeclaration> HarvestDeclarations { get; set; } = new List<HarvestDeclaration>();
}

