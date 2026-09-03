namespace SistemaKyoGroup.Application.Models.Grid;

public class DataTablesResponse<T>
{
    public int draw { get; set; }
    public int recordsTotal { get; set; }
    public int recordsFiltered { get; set; }
    public List<T> data { get; set; } = new();
}
