namespace SistemaKyoGroup.BLL.Service
{
    public interface IConfiguracionNombreService<T> where T : class
    {
        Task<List<T>> Listar();
        Task<bool> Insertar(T model);
        Task<bool> Actualizar(T model);
        Task<bool> Eliminar(int id);
        Task<T?> BuscarDuplicado(T model, int idExcluir);
        int GetId(T model);
        string GetNombre(T model);
    }
}
