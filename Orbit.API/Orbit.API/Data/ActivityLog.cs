using System;
using System.ComponentModel.DataAnnotations;

namespace OrbitBackend.Entities
{
    public class ActivityLog
    {
        [Key]
        public int LogId { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public int ProjectId { get; set; }
    }
}