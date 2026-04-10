using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class RoleApplication
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ApplicantUserId { get; set; }
    public User ApplicantUser { get; set; } = default!;

    [MaxLength(100)]
    public string TargetRole { get; set; } = string.Empty;

    [MaxLength(40)]
    public string Status { get; set; } = "Pending";

    public string? FormDataJson { get; set; }
    public string? AdminNote { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<RoleApplicationMessage> Messages { get; set; } = new List<RoleApplicationMessage>();
    public ICollection<RoleApplicationDocument> Documents { get; set; } = new List<RoleApplicationDocument>();
}

public class RoleApplicationMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RoleApplicationId { get; set; }
    public RoleApplication RoleApplication { get; set; } = default!;

    [MaxLength(20)]
    public string SenderType { get; set; } = "Applicant";

    [MaxLength(200)]
    public string SenderName { get; set; } = string.Empty;

    [MaxLength(3000)]
    public string Message { get; set; } = string.Empty;

    public bool IsReadByAdmin { get; set; }
    public bool IsReadByApplicant { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class RoleApplicationDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RoleApplicationId { get; set; }
    public RoleApplication RoleApplication { get; set; } = default!;

    [MaxLength(200)]
    public string DocumentName { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string DocumentUrl { get; set; } = string.Empty;

    [MaxLength(250)]
    public string? OriginalFileName { get; set; }

    [MaxLength(120)]
    public string? ContentType { get; set; }

    [MaxLength(20)]
    public string UploadedBy { get; set; } = "Applicant";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
