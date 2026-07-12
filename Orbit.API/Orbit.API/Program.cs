using Microsoft.EntityFrameworkCore;
using Orbit.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Orbit.API.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1. Hook up our Database Context dynamically based on connection string type
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (connectionString != null && (connectionString.Contains("Host=") || connectionString.Contains("postgresql://") || connectionString.Contains("Port=")))
{
    builder.Services.AddDbContext<OrbitDbContext>(options =>
        options.UseNpgsql(connectionString));
}
else
{
    builder.Services.AddDbContext<OrbitDbContext>(options =>
        options.UseSqlServer(connectionString));
}

builder.Services.AddSignalR();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 2. Enable CORS (Cross-Origin Resource Sharing)
builder.Services.AddCors(options =>
{
  options.AddPolicy("AllowAngular",
      policy =>
      {
        policy.WithOrigins("http://localhost:4200", "https://orbit-frontend-live.onrender.com")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
      });
});

// 3. PHASE 3: Configure JWT Authentication Services
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"];

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
    };
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 4. CRITICAL MIDDLEWARE EXECUTION PIPELINE ORDER
app.UseCors("AllowAngular"); // CORS must stay on top layers

app.MapHub<NotificationHub>("/orbitNotificationHub");

app.UseAuthentication(); // 1st: Checks who the user is (Validates JWT Token)
app.UseAuthorization();  // 2nd: Checks what permissions the user has

app.MapControllers();

app.Run();
