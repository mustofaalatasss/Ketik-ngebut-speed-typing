using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace KetikNgebut.Infrastructure.Persistence;

/// <summary>
/// Dipakai hanya oleh alat `dotnet ef migrations` agar tidak perlu menjalankan Program.cs
/// (yang menolak start tanpa Jwt:SigningKey). Tidak dipakai saat aplikasi berjalan.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=design-time.db")
            .Options;
        return new AppDbContext(options);
    }
}
