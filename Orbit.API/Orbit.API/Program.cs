using Microsoft.EntityFrameworkCore;
using Orbit.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Orbit.API.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1. Hook up our SQL Server Database Connection String
// ?? UPDATE THIS ENGINE PATH MATRIX INSIDE Program.cs:
builder.Services.AddDbContext<OrbitDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddSignalR();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 2. Enable CORS (Cross-Origin Resource Sharing)
builder.Services.AddCors(options => {
    options.AddPolicy("AllowAngular", policy => {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyMethod()
              .AllowAnyHeader();
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

app.UseCors(policy => policy
    .WithOrigins("http://localhost:4200") // Your Angular app node route
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials());

app.MapHub<NotificationHub>("/orbitNotificationHub");

app.UseAuthentication(); // 1st: Checks who the user is (Validates JWT Token)
app.UseAuthorization();  // 2nd: Checks what permissions the user has

app.MapControllers();

app.Run();