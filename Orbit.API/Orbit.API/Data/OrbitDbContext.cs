using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations; // For the [Key] attribute
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Orbit.API.Data
{
    public class OrbitDbContext : DbContext
    {
        public OrbitDbContext(DbContextOptions<OrbitDbContext> options) : base(options) { }

        // Register all four linked database tables
        public DbSet<TaskItem> Tasks { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<User> Users { get; set; }

        public DbSet<Orbit.API.Models.Comment> Comments { get; set; }
        public DbSet<ProjectMember> ProjectMembers { get; set; }

        // SPOT 1: Registered ActivityLog table context link
        public DbSet<ActivityLog> ActivityLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 1. Force explicit table mappings to match your exact SQL Server table names
            modelBuilder.Entity<TaskItem>().ToTable("Tasks");
            modelBuilder.Entity<Project>().ToTable("Projects");
            modelBuilder.Entity<User>().ToTable("Users");

            // SPOT 2: Drop explicit table mapping configuration for ActivityLogs
            modelBuilder.Entity<ActivityLog>().ToTable("ActivityLogs");

            // 2. Explicitly define Primary Keys
            modelBuilder.Entity<TaskItem>().HasKey(t => t.TaskId);
            modelBuilder.Entity<Project>().HasKey(p => p.ProjectId);
            modelBuilder.Entity<User>().HasKey(u => u.UserId);
            modelBuilder.Entity<ActivityLog>().HasKey(a => a.LogId);

            // Composite Primary Key configuration mapping
            modelBuilder.Entity<ProjectMember>().ToTable("ProjectMembers");
            modelBuilder.Entity<ProjectMember>().HasKey(pm => new { pm.ProjectId, pm.UserId });

            // 3. Configure the Relationships (Foreign Keys) matching our SQL blueprint
            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.Project)
                .WithMany(p => p.Tasks)
                .HasForeignKey(t => t.ProjectId);

            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.User)
                .WithMany(u => u.Tasks)
                .HasForeignKey(t => t.AssignedToUserId);
        }
    }

    // --- CONCEPTUAL DATABASE LAYOUT ENTITIES ---

    // SPOT 3: Added the explicit entity structure blueprint matching SQL Schema
    public class ActivityLog
    {
        [Key]
        public int LogId { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public int ProjectId { get; set; }
    }

    public class TaskItem
    {
        [Key]
        public int TaskId { get; set; }

        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = "To-Do";
        public string Priority { get; set; } = "Medium";
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // FIXED: Added tracking order property to persist sorting positions flawlessly
        public int DisplayOrder { get; set; } = 0;

        // Foreign Key IDs
        public int ProjectId { get; set; }
        public int? AssignedToUserId { get; set; }

        // Navigation Properties (Tells EF Core how tables connect conceptually)
        [JsonIgnore]
        public Project? Project { get; set; }
        [JsonIgnore]
        public User? User { get; set; }
    }

    public class Project
    {
        [Key]
        public int ProjectId { get; set; }

        [Column("ProjectName")] // <-- Maps C# 'Name' directly to SQL 'ProjectName'
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        public int OrgId { get; set; } // <-- Added to perfectly match database structure

        public int? CreatedByUserId { get; set; } // <-- Added to track project creator

        [JsonIgnore]
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }

    public class User
    {
        [Key]
        public int UserId { get; set; }

        public string FullName { get; set; } = string.Empty; // <-- Must match 'FullName' in SQL exactly!
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = "Developer";

        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        public bool IsEmailVerified { get; set; } = false;
        public string? VerificationToken { get; set; }


        [JsonIgnore]
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }

    public class ProjectMember
    {
        public int ProjectId { get; set; }
        public int UserId { get; set; }
        public DateTime AssignedAt { get; set; } = DateTime.Now;
    }
}