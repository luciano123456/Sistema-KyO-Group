namespace SistemaKyoGroup.Application.Configuration
{
    /// <summary>
    /// Duración de sesión: configurar solo en appsettings.json (SessionSettings).
    /// Total = DurationHours + DurationMinutes (ej. 24 h + 0 min; pruebas: 0 h + 1 min).
    /// </summary>
    public class SessionSettings
    {
        public int DurationHours { get; set; }

        public int DurationMinutes { get; set; }

        public TimeSpan GetDuration()
            => TimeSpan.FromHours(DurationHours) + TimeSpan.FromMinutes(DurationMinutes);
    }
}
