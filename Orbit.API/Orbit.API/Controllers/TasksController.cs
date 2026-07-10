using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Orbit.API.Data;
using Orbit.API.Hubs;
using Orbit.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Orbit.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TasksController : ControllerBase
    {
        private readonly OrbitDbContext _context;
        private readonly IHubContext<NotificationHub> _hubContext;

        // 🎯 UNIFIED CORE DEPENDENCY INJECTION CONSTRUCTOR
        public TasksController(OrbitDbContext context, IHubContext<NotificationHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        // 1. GET: api/Tasks/project/{projectId}
        [HttpGet("project/{projectId}")]
        public async Task<ActionResult<IEnumerable<Orbit.API.Data.TaskItem>>> GetTasksByProject(int projectId)
        {
            var tasks = await _context.Tasks
                                     .Where(t => t.ProjectId == projectId)
                                     .ToListAsync();

            System.Diagnostics.Debug.WriteLine($"SQL Server Found {tasks.Count} tasks for Project #{projectId}");
            return Ok(tasks);
        }

        // 2. PUT: api/Tasks/update-status
        [HttpPut("update-status")]
        public async Task<IActionResult> UpdateTaskStatus([FromBody] UpdateStatusDto dto)
        {
            var task = await _context.Tasks.FindAsync(dto.TaskId);
            if (task == null)
            {
                return NotFound("Task not found in the database.");
            }

            string oldStatus = task.Status;
            task.Status = dto.NewStatus;
            await _context.SaveChangesAsync();

            // 🛰️ SIGNALR REAL-TIME NOTIFICATION BROADCAST
            string alertText = $"⚡ Status updated for task card #{dto.TaskId}: '{oldStatus}' ➔ '{dto.NewStatus}'";
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", alertText, "StatusAlert");

            return Ok(new { Message = "Database status updated successfully!" });
        }

        // POST: api/Tasks
        [HttpPost]
        public async Task<IActionResult> CreateTask([FromBody] TaskItem newTask)
        {
            if (newTask == null)
            {
                return BadRequest("Task data cannot be null.");
            }

            newTask.CreatedAt = DateTime.Now;
            _context.Tasks.Add(newTask);

            string actionUser = Request.Headers["X-Action-User"].ToString();
            if (string.IsNullOrEmpty(actionUser)) actionUser = "Authorized User";

            // Telemetry System Log
            var log = new ActivityLog
            {
                Message = $"✨ Fresh task card '{newTask.Title}' was created by {actionUser}.",
                ProjectId = newTask.ProjectId,
                Timestamp = DateTime.Now
            };
            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            // 🛰️ SIGNALR REAL-TIME NOTIFICATION BROADCAST
            string alertText = $"🚀 New task provisioned by {actionUser}: '{newTask.Title}'";
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", alertText, "CreationAlert");

            return CreatedAtAction(nameof(GetTasksByProject), new { projectId = newTask.ProjectId }, newTask);
        }

        // GET: api/Tasks/projects?userId=1
        [HttpGet("projects")]
        public async Task<IActionResult> GetProjects([FromQuery] int? userId)
        {
            if (userId == null || userId == 0)
            {
                return BadRequest("Auditing identity verification parameter user ID missing.");
            }

            var assignedProjectIds = await _context.ProjectMembers
                .Where(pm => pm.UserId == userId)
                .Select(pm => pm.ProjectId)
                .ToListAsync();

            var assignedProjects = await _context.ProjectMembers
                .Where(pm => pm.UserId == userId)
                .Select(pm => _context.Projects.FirstOrDefault(p => p.ProjectId == pm.ProjectId))
                .Where(p => p != null)
                .ToListAsync();

            var createdProjects = await _context.Projects
                .Where(p => p.CreatedByUserId == userId)
                .ToListAsync();

            var activeTaskProjectIds = await _context.Tasks
                .Where(t => t.AssignedToUserId == userId)
                .Select(t => t.ProjectId)
                .Distinct()
                .ToListAsync();

            var taskRelatedProjects = await _context.Projects
                .Where(p => activeTaskProjectIds.Contains(p.ProjectId))
                .ToListAsync();

            var combinedProjects = assignedProjects
                .Concat(createdProjects)
                .Concat(taskRelatedProjects)
                .Where(p => p != null)
                .GroupBy(p => p!.ProjectId)
                .Select(g => g!.First())
                .ToList();

            var combinedProjectsResponse = combinedProjects.Select(p => new
            {
                p.ProjectId,
                p.Name,
                p.Description,
                p.OrgId,
                p.CreatedByUserId,
                isAssigned = assignedProjectIds.Contains(p.ProjectId)
            });

            return Ok(combinedProjectsResponse);
        }

        // DELETE: api/Tasks/project/1
        [HttpDelete("project/{id}")]
        public async Task<IActionResult> DeleteProject(int id)
        {
            string rawUserId = Request.Headers["X-Action-User-Id"].ToString();
            if (string.IsNullOrEmpty(rawUserId))
            {
                return BadRequest("Identity parameters missing.");
            }

            int requestUserId = int.Parse(rawUserId);
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound("Project workspace not found.");

            if (project.CreatedByUserId != requestUserId)
            {
                return StatusCode(403, "Access Denied: Only the original Creator/Owner can delete this project workspace.");
            }

            // Direct database deletion using ExecuteDeleteAsync for sub-millisecond execution speeds
            var taskIds = await _context.Tasks.Where(t => t.ProjectId == id).Select(t => t.TaskId).ToListAsync();
            await _context.Comments.Where(c => taskIds.Contains(c.TaskId)).ExecuteDeleteAsync();
            await _context.Tasks.Where(t => t.ProjectId == id).ExecuteDeleteAsync();
            await _context.ProjectMembers.Where(pm => pm.ProjectId == id).ExecuteDeleteAsync();
            await _context.ActivityLogs.Where(al => al.ProjectId == id).ExecuteDeleteAsync();
            await _context.Projects.Where(p => p.ProjectId == id).ExecuteDeleteAsync();

            return Ok(new { message = $"Project #{id} successfully wiped out by its Owner." });
        }

        // POST: api/Tasks/project
        [HttpPost("project")]
        public async Task<IActionResult> CreateProject([FromBody] Orbit.API.Data.Project newProject)
        {
            if (newProject == null || string.IsNullOrWhiteSpace(newProject.Name))
            {
                return BadRequest("Project details cannot be empty.");
            }

            bool nameExists = await _context.Projects
                .AnyAsync(p => p.Name.ToLower().Trim() == newProject.Name.ToLower().Trim());

            if (nameExists)
            {
                return BadRequest($"Conflict: A project board named '{newProject.Name}' already exists.");
            }

            if (newProject.OrgId == 0) newProject.OrgId = 1;

            string rawUserId = Request.Headers["X-Action-User-Id"].ToString();
            int creatorUserId = !string.IsNullOrEmpty(rawUserId) ? int.Parse(rawUserId) : 1;

            newProject.CreatedByUserId = creatorUserId;
            _context.Projects.Add(newProject);
            await _context.SaveChangesAsync();

            var junctionEntry = new ProjectMember
            {
                ProjectId = newProject.ProjectId,
                UserId = creatorUserId,
                AssignedAt = DateTime.Now
            };
            _context.ProjectMembers.Add(junctionEntry);
            await _context.SaveChangesAsync();

            return StatusCode(201, newProject);
        }

        // PUT: api/Tasks/project/5
        [HttpPut("project/{id}")]
        public async Task<IActionResult> UpdateProject(int id, [FromBody] Orbit.API.Data.Project updatedProject)
        {
            if (updatedProject == null || string.IsNullOrWhiteSpace(updatedProject.Name))
            {
                return BadRequest("Project details cannot be empty.");
            }

            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound("Project workspace not found.");

            string rawUserId = Request.Headers["X-Action-User-Id"].ToString();
            if (string.IsNullOrEmpty(rawUserId))
            {
                return BadRequest("Identity parameters missing.");
            }

            int requestUserId = int.Parse(rawUserId);
            if (project.CreatedByUserId != requestUserId)
            {
                return StatusCode(403, "Access Denied: Only the original Creator/Owner can edit this project workspace.");
            }

            // Check if name is taken by another project
            bool nameExists = await _context.Projects
                .AnyAsync(p => p.ProjectId != id && p.Name.ToLower().Trim() == updatedProject.Name.ToLower().Trim());

            if (nameExists)
            {
                return BadRequest($"Conflict: A project board named '{updatedProject.Name}' already exists.");
            }

            project.Name = updatedProject.Name.Trim();
            project.Description = updatedProject.Description?.Trim();

            await _context.SaveChangesAsync();

            return Ok(project);
        }

        // DELETE: api/Tasks/5
        [HttpDelete("{taskId}")]
        public async Task<IActionResult> DeleteTask(int taskId)
        {
            var task = await _context.Tasks.FindAsync(taskId);
            if (task == null)
            {
                return NotFound($"Task with ID #{taskId} not found.");
            }

            string actionUser = Request.Headers["X-Action-User"].ToString();
            if (string.IsNullOrEmpty(actionUser)) actionUser = "Authorized User";

            var log = new ActivityLog
            {
                Message = $"🗑️ Task card '{task.Title}' was permanently deleted by {actionUser}.",
                ProjectId = task.ProjectId,
                Timestamp = DateTime.Now
            };
            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            // Direct database deletion for task comments and task itself
            await _context.Comments.Where(c => c.TaskId == taskId).ExecuteDeleteAsync();
            await _context.Tasks.Where(t => t.TaskId == taskId).ExecuteDeleteAsync();

            // 🛰️ SIGNALR REAL-TIME NOTIFICATION BROADCAST
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", $"🗑️ Task permanently wiped out by {actionUser}: '{task.Title}'", "DeletionAlert");

            return Ok(new { message = $"Task #{taskId} successfully removed." });
        }

        // GET: api/Tasks/users
        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<Orbit.API.Data.User>>> GetUsers()
        {
            var users = await _context.Users.ToListAsync();
            if (users == null || !users.Any())
            {
                return NotFound("No users found in the database matrix.");
            }
            return Ok(users);
        }

        // PUT: api/Tasks/edit
        [HttpPut("edit")]
        public async Task<IActionResult> EditTask([FromBody] Orbit.API.Data.TaskItem updatedTask)
        {
            if (updatedTask == null || updatedTask.TaskId == 0)
            {
                return BadRequest("Invalid task modification payload.");
            }

            var existingTask = await _context.Tasks.FindAsync(updatedTask.TaskId);
            if (existingTask == null)
            {
                return NotFound($"Task card #{updatedTask.TaskId} does not exist.");
            }

            existingTask.Title = updatedTask.Title;
            existingTask.Description = updatedTask.Description;
            existingTask.Priority = updatedTask.Priority;
            existingTask.AssignedToUserId = updatedTask.AssignedToUserId;

            await _context.SaveChangesAsync();

            // 🛰️ SIGNALR REAL-TIME NOTIFICATION BROADCAST
            string alertText = $"📝 Task parameters updated: '{updatedTask.Title}'";
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", alertText, "EditAlert");

            return Ok(new { message = $"Task #{updatedTask.TaskId} successfully updated." });
        }

        // PUT: api/Tasks/update-orders (Drag & Drop Reordering Node)
        [HttpPut("update-orders")]
        public async Task<IActionResult> UpdateTaskOrders([FromBody] List<TaskItem> updatedTasks)
        {
            if (updatedTasks == null || !updatedTasks.Any())
            {
                return BadRequest("Payload cannot be empty.");
            }

            int currentProjectScopeId = updatedTasks.First().ProjectId;
            string targetColumnStatus = updatedTasks.First().Status;

            string movedTaskTitle = Request.Headers["X-Moved-Task-Title"].ToString();
            if (string.IsNullOrEmpty(movedTaskTitle)) movedTaskTitle = "A task card";

            string actionUser = Request.Headers["X-Action-User"].ToString();
            if (string.IsNullOrEmpty(actionUser)) actionUser = "Authorized User";

            foreach (var updatedTask in updatedTasks)
            {
                var existingTask = await _context.Tasks.FindAsync(updatedTask.TaskId);
                if (existingTask != null)
                {
                    existingTask.Status = updatedTask.Status;
                    existingTask.DisplayOrder = updatedTask.DisplayOrder;
                }
            }

            var log = new ActivityLog
            {
                Message = $"🔄 Task card '{movedTaskTitle}' execution flow moved to column: '{targetColumnStatus}' by {actionUser}.",
                ProjectId = currentProjectScopeId,
                Timestamp = DateTime.Now
            };
            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            // 🛰️ SIGNALR REAL-TIME NOTIFICATION BROADCAST (Live Sprint Board Sync)
            string alertText = $"🔄 Agile Board Telemetry: '{movedTaskTitle}' shifted to '{targetColumnStatus}' by {actionUser}";
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", alertText, "DragDropAlert");

            return Ok(new { message = "All task card alignment positions saved successfully!" });
        }

        // GET api/Tasks/project/{projectId}/logs
        [HttpGet("project/{projectId}/logs")]
        public async Task<IActionResult> GetProjectActivityLogs(int projectId)
        {
            var logs = await _context.ActivityLogs
                                     .Where(l => l.ProjectId == projectId)
                                     .OrderByDescending(l => l.Timestamp)
                                     .Take(8)
                                     .ToListAsync();

            return Ok(logs);
        }

        // ==========================================================================
        // 💬 FRESH TASK COMMENTS HUB SUBSYSTEM NODE
        // ==========================================================================

        // POST: api/Tasks/comment
        [HttpPost("comment")]
        public async Task<IActionResult> AddTaskComment([FromBody] Comment comment)
        {
            if (comment == null || string.IsNullOrEmpty(comment.Message.Trim()))
            {
                return BadRequest("Comment configuration message body metadata missing.");
            }

            comment.CreatedAt = DateTime.UtcNow;
            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();

            // 🎯 SIGNALR BROADCAST INTEGRATION
            var targetTask = await _context.Tasks.FindAsync(comment.TaskId);
            string alertText = $"💬 {comment.UserFullName} left a comment on task: \"{targetTask?.Title}\"";

            await _hubContext.Clients.Group($"Project_{targetTask?.ProjectId}").SendAsync("ReceiveNotification", alertText, "CommentAlert");

            return Ok(comment);
        }

        // GET: api/Tasks/task/5/comments
        [HttpGet("task/{taskId}/comments")]
        public async Task<ActionResult<IEnumerable<Comment>>> GetTaskComments(int taskId)
        {
            var comments = await _context.Comments
                .Where(c => c.TaskId == taskId)
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            return Ok(comments);
        }
    }

    // --- SHARED DATA TRANSFER OBJECTS ---
    public class UpdateStatusDto
    {
        public int TaskId { get; set; }
        public string NewStatus { get; set; }
    }
}