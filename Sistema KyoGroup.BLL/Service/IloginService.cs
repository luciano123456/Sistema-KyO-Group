using SistemaKyoGroup.Models;
using System.Net.Http;

namespace SistemaKyoGroup.BLL.Service
{
    public interface ILoginService
    {
        Task<User> Login(string username, string password);

        Task<bool> Logout();
    }
}
