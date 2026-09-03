using SistemaKyoGroup.Application.Models.Grid;
using SistemaKyoGroup.DAL.Grid;

namespace SistemaKyoGroup.Application.Helpers;

public static class DataTablesRequestHelper
{
    public static int GetDraw(HttpRequest request)
    {
        return int.TryParse(request.Query["draw"], out var d) ? d : 0;
    }

    public static GridQuery Parse(HttpRequest request, int maxTake = 200)
    {
        var q = new GridQuery
        {
            Skip = int.TryParse(request.Query["start"], out var s) ? Math.Max(0, s) : 0,
            Take = Math.Clamp(int.TryParse(request.Query["length"], out var l) ? l : 10, 1, maxTake),
            Search = request.Query["search[value]"].FirstOrDefault()?.Trim()
        };

        if (int.TryParse(request.Query["order[0][column]"], out var col))
            q.OrderColumn = col;

        q.OrderDesc = request.Query["order[0][dir]"].FirstOrDefault()?.ToLowerInvariant() == "desc";

        for (var i = 0; i < 30; i++)
        {
            var colSearch = request.Query[$"columns[{i}][search][value]"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(colSearch))
                q.ColumnSearches[i] = NormalizeColumnSearch(colSearch);
        }

        return q;
    }

    public static string NormalizeColumnSearch(string value)
    {
        var v = value.Trim();
        if (v.StartsWith("(((", StringComparison.Ordinal) && v.EndsWith(")))", StringComparison.Ordinal) && v.Length > 6)
            return v.Substring(3, v.Length - 6);
        if (v.StartsWith('^') && v.EndsWith('$') && v.Length > 2)
            return v.Substring(1, v.Length - 2);
        return v;
    }

    public static DataTablesResponse<T> ToResponse<T>(int draw, GridResult<T> result)
    {
        return new DataTablesResponse<T>
        {
            draw = draw,
            recordsTotal = result.Total,
            recordsFiltered = result.Filtered,
            data = result.Items
        };
    }
}
