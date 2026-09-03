using System.Collections.Generic;

namespace SistemaKyoGroup.Models.Analisis;

public class AnalisisChartPoint
{
    public string Label { get; set; } = "";
    public decimal Valor { get; set; }
    public int Cantidad { get; set; }
}

public class AnalisisReporteDto
{
    public decimal Total { get; set; }
    public int Cantidad { get; set; }
    public List<AnalisisChartPoint> Serie { get; set; } = new();
    public List<AnalisisChartPoint> Ranking { get; set; } = new();
}
