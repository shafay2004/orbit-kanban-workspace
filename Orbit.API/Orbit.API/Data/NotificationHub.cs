using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace Orbit.API.Hubs
{
    public class NotificationHub : Hub
    {
        // Global broadcast network channel for instant user notifications
        public async Task BroadcastNotification(string message, string type)
        {
            await Clients.All.SendAsync("ReceiveNotification", message, type);
        }

        // 🎯 OMNI-CHANNEL GROUP ROUTING LOOPS (UPDATED FOR PRODUCTION ISOLATION)
        public async Task JoinProjectGroup(string projectId)
        {
            string roomName = $"Project_{projectId}";

            // Wire connection to the targeted group channel dynamically
            await Groups.AddToGroupAsync(Context.ConnectionId, roomName);

            System.Diagnostics.Debug.WriteLine($"🛰️ System Telemetry: Connection ID '{Context.ConnectionId}' locked to Stream: {roomName}");
        }
    }
}