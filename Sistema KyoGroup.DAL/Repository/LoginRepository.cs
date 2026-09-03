using Microsoft.EntityFrameworkCore;
using SistemaKyoGroup.DAL.DataContext;
using SistemaKyoGroup.Models;

namespace SistemaKyoGroup.DAL.Repository
{
    public class LoginRepository : ILoginRepository<User>
    {

        private readonly SistemaKyoGroupContext _dbcontext;

        public LoginRepository(SistemaKyoGroupContext context)
        {
            _dbcontext = context;
        }

        public async Task<User> Login(string username, string password)
        { 
            User user = await _dbcontext.Usuarios
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Usuario == username);

            if (user != null)
            {
                return user;
            } else
            {
                return null;
            }
        }

        public async Task<bool> Logout()
        {
            return true;
        }

    }
}
