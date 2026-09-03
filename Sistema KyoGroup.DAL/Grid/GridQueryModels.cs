namespace SistemaKyoGroup.DAL.Grid;

public class GridQuery
{
    public int Skip { get; set; }
    public int Take { get; set; } = 10;
    public string? Search { get; set; }
    public int OrderColumn { get; set; }
    public bool OrderDesc { get; set; }
    public Dictionary<int, string> ColumnSearches { get; set; } = new();
}

public class GridResult<T>
{
    public int Total { get; set; }
    public int Filtered { get; set; }
    public List<T> Items { get; set; } = new();
}
