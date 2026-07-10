using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Orbit.API.Models;

namespace Orbit.API.Models
{
    public class Comment
    {
        [Key]
        public int CommentId { get; set; }

        [Required]
        public string Message { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        public int TaskId { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public string UserFullName { get; set; } = string.Empty; // Denormalized for fast fetch mapping
    }
}