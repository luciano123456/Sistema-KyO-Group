namespace SistemaKyoGroup.Application.Models
{
    public class DbErrorHelper
    {
        public string? RequestId { get; set; }

        public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
    }

    public class ErrorViewModel
    {
        public string? RequestId { get; set; }
        public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);

        public string? Message { get; set; } // <-- agregado
    }

}