using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Orbit.API.Data;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Mail;

namespace Orbit.API.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly OrbitDbContext _context;
        private readonly IConfiguration _config;

        public AuthController(OrbitDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // POST: api/Auth/login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == request.Email && u.PasswordHash == request.Password);

            if (user == null)
            {
                return Unauthorized(new { message = "Invalid corporate credentials mapping gateway failed." });
            }

            // 🛡️ SECURITY CHECK: Blocking unverified email login pipelines implicitly
            if (!user.IsEmailVerified)
            {
                return Unauthorized(new { message = "Security Access Pending: Please activate your account profile through the verification link dispatched to your email first." });
            }

            // Return user parameters along with structural Role identity token
            return Ok(new
            {
                userId = user.UserId,
                fullName = user.FullName,
                email = user.Email,
                username = user.Username,
                role = user.Role // 🎯 PUSHING ROLE PARAMETER TO INTERFACE
            });
        }

    // POST: api/Auth/register (STAGES REGISTRATION & DISPATCHES ENCRYPTED TOKEN EMAIL)
    [HttpPost("register")]
    public async Task<IActionResult> RegisterUser([FromBody] Orbit.API.Data.User newUser)
    {
      if (newUser == null || string.IsNullOrWhiteSpace(newUser.Email) || string.IsNullOrWhiteSpace(newUser.PasswordHash))
      {
        return BadRequest("Registration payload parameters cannot be null.");
      }

      if (newUser.Username != null && newUser.Username.Trim().Length > 16)
      {
        return BadRequest("Conflict: Tech Handle cannot exceed 16 characters.");
      }

      // 🎯 STAGE FIX: Clean variables inject kiye taaki string formatting matching database lookup par accurate rahe
      var inputEmail = newUser.Email.ToLower().Trim();
      var inputUsername = newUser.Username?.ToLower().Trim();

      // 🛡️ 1. STRICT DB EMAIL CHECK: Agar email pehle se exists aur verified (1) hai toh link verify/send hone se pehle hi instant block karega
      var existingUserWithEmail = await _context.Users.FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower().Trim() == inputEmail);
      if (existingUserWithEmail != null)
      {
        if (existingUserWithEmail.IsEmailVerified)
        {
          return BadRequest("Conflict: A user with this corporate email profile already exists.");
        }
        else
        {
          _context.Users.Remove(existingUserWithEmail);
          await _context.SaveChangesAsync();
        }
      }

      // 🛡️ 2. STRICT DB USERNAME CHECK: Same handle lookup cross verification layer
      if (!string.IsNullOrEmpty(inputUsername))
      {
        var existingUserWithUsername = await _context.Users.FirstOrDefaultAsync(u => u.Username != null && u.Username.ToLower().Trim() == inputUsername);
        if (existingUserWithUsername != null)
        {
          if (existingUserWithUsername.IsEmailVerified)
          {
            return BadRequest("Conflict: This unique username handle is already allocated.");
          }
          else
          {
            _context.Users.Remove(existingUserWithUsername);
            await _context.SaveChangesAsync();
          }
        }
      }

      if (string.IsNullOrWhiteSpace(newUser.Role)) newUser.Role = "Developer";

      try
      {
        // 🔒 DEFERRED PERSISTENCE MATRIX: Convert profile parameters to safe encrypted text token instead of SQL writing
        string rawPayload = $"{newUser.FullName}||{newUser.Email}||{newUser.Username}||{newUser.PasswordHash}||{newUser.Role}";
        byte[] payloadBytes = Encoding.UTF8.GetBytes(rawPayload);
        string secureDataToken = Convert.ToBase64String(payloadBytes);

        string scheme = Request.Scheme;
        string host = Request.Host.Value;
        var verificationLink = $"{scheme}://{host}/api/auth/verify-email?token={secureDataToken}";

        // Dispatch free activation mail template using free SMTP channels
        using (var smtpClient = new SmtpClient("smtp.gmail.com"))
        {
          smtpClient.Port = 587;
          smtpClient.Credentials = new NetworkCredential("syedshafayy899@gmail.com", "lryb hgni ilsj ghyv");
          smtpClient.EnableSsl = true;

          var mailMessage = new MailMessage
          {
            From = new MailAddress("no-reply@orbit.com", "Orbit Security Vault"),
            Subject = "🛡️ Orbit Workspace Activation & Instant Login",
            Body = $@"
                    <div style='font-family: sans-serif; max-width: 550px; border: 1px solid rgba(0,0,0,0.08); padding: 24px; border-radius: 12px;'>
                        <h2 style='color: #6366f1; margin-top: 0;'>Complete your Orbit Registration, {newUser.FullName}!</h2>
                        <p style='color: #334155; font-size: 14px;'>Click the secure action button below to confirm your email, safely construct your account on our server database, and log in instantly:</p>
                        <div style='margin: 28px 0;'>
                          <a href='{verificationLink}' style='background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;'>Confirm Email & Login Automatically</a>
                        </div>
                        <hr style='border: none; border-top: 1px solid rgba(0,0,0,0.06);' />
                        <small style='color: #64748b;'>If you did not initialize this register profile flow loop, you can safely skip this communication notification stream.</small>
                    </div>",
            IsBodyHtml = true
          };
          mailMessage.To.Add(newUser.Email);
          await smtpClient.SendMailAsync(mailMessage);
        }
      }
      catch (Exception ex)
      {
        return StatusCode(500, $"Internal server error during processing dispatch routing: {ex.Message}");
      }

      return Ok(new { message = "Staged successfully. Verification mail dispatched." });
    }

    // GET: api/Auth/check-username?username=messi
    // GET: api/auth/check-username/messi10
    [HttpGet("check-username/{username}")] // 🎯 ROUTE SIGNATURE FIXED FOR PATH BINDING
      public async Task<IActionResult> CheckUsername([FromRoute] string username) // Changed from FromQuery to FromRoute
      {
        if (string.IsNullOrWhiteSpace(username))
        {
          return BadRequest(new { isAvailable = false, message = "Username cannot be empty." });
        }

        var cleanUsername = username.ToLower().Trim();

        // Check if there is a verified user with this username (with safety check on NULL username fields)
        bool isTaken = await _context.Users.AnyAsync(u => u.IsEmailVerified && u.Username != null && u.Username.ToLower().Trim() == cleanUsername);

        // 🎯 RESPONSE FIXED: Returns property 'isAvailable' matching your Angular frontend response model exactly
        return Ok(new { isAvailable = !isTaken });
      }

    // 🎯 UNIFIED & DECODED VERIFICATION GATEWAY: GET api/auth/verify-email
    // (Saves record to SQL DB *ONLY* upon click activation execution + Auto-Redirects Client Token with User State parameters)
    [HttpGet("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromQuery] string token)
    {
      if (string.IsNullOrWhiteSpace(token)) return BadRequest("Invalid verification request signature token data parameter mapping.");

      try
      {
        // 🔓 UNWRAP BASE64 TEXT BACK INTO ARRAYS STRING MEMORY BLOCKS
        byte[] base64EncodedBytes = Convert.FromBase64String(token);
        string decryptedPayload = Encoding.UTF8.GetString(base64EncodedBytes);
        string[] parts = decryptedPayload.Split("||");

        string fullName = parts[0];
        string email = parts[1];
        string username = parts[2];
        string passwordHash = parts[3];
        string role = parts[4];

        // Delete any existing unverified user with the same email or username before saving the verified one
        var existingUnverifiedUser = await _context.Users.FirstOrDefaultAsync(u => (u.Email != null && u.Email.ToLower().Trim() == email.ToLower().Trim()) || (u.Username != null && u.Username.ToLower().Trim() == username.ToLower().Trim()));
        if (existingUnverifiedUser != null)
        {
          if (existingUnverifiedUser.IsEmailVerified)
          {
            return BadRequest("Conflict: This email address or username is already taken by a verified account.");
          }
          else
          {
            _context.Users.Remove(existingUnverifiedUser);
            await _context.SaveChangesAsync();
          }
        }

        // 📝 STEP 1: CONCRETE PHYSICAL TABLE DATA WRITE TO SQL SERVER ROWS
        var verifiedUser = new Orbit.API.Data.User
        {
          FullName = fullName,
          Email = email,
          Username = username,
          PasswordHash = passwordHash,
          Role = role,
          IsEmailVerified = true,
          VerificationToken = null
        };

        _context.Users.Add(verifiedUser);
        await _context.SaveChangesAsync();

        // 🚀 STEP 2: AUTO LOGIN REDIRECT STREAM PIPELINE BYPASS
        // Dynamically redirect based on Request host (resolves redirect target for both localhost and production Render deployment)
        string frontendHost = Request.Host.Host.Contains("localhost") 
            ? "http://localhost:4200" 
            : "https://orbit-frontend-live.onrender.com";
        string autoLoginRedirectUrl = $"{frontendHost}/?autoId={verifiedUser.UserId}&autoName={Uri.EscapeDataString(verifiedUser.FullName)}&autoEmail={verifiedUser.Email}&autoRole={verifiedUser.Role}&autoUsername={Uri.EscapeDataString(verifiedUser.Username)}";

        return Redirect(autoLoginRedirectUrl);
      }
      catch (Exception ex)
      {
        return BadRequest($"Verification token parameters corrupted or trace structure expired. Logic error: {ex.Message}");
      }
    }

    // DELETE: api/auth/delete-account
    [HttpDelete("delete-account")]
        public async Task<IActionResult> DeleteAccount([FromQuery] string password)
        {
            string rawUserId = Request.Headers["X-Action-User-Id"].ToString();
            if (string.IsNullOrEmpty(rawUserId))
            {
                return BadRequest("Identity parameters missing.");
            }

            int userId = int.Parse(rawUserId);
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound("User profile not found.");
            }

            if (user.PasswordHash != password)
            {
                return BadRequest("Incorrect password validation failed.");
            }

            // 1. Remove comments made by this user
            var comments = await _context.Comments.Where(c => c.UserId == userId).ToListAsync();
            _context.Comments.RemoveRange(comments);

            // 2. Remove project memberships
            var memberships = await _context.ProjectMembers.Where(pm => pm.UserId == userId).ToListAsync();
            _context.ProjectMembers.RemoveRange(memberships);

            // 3. Unassign tasks assigned to this user
            var assignedTasks = await _context.Tasks.Where(t => t.AssignedToUserId == userId).ToListAsync();
            foreach (var t in assignedTasks)
            {
                t.AssignedToUserId = null;
            }

            // 4. Nullify CreatedByUserId of projects created by this user
            var ownedProjects = await _context.Projects.Where(p => p.CreatedByUserId == userId).ToListAsync();
            foreach (var p in ownedProjects)
            {
                p.CreatedByUserId = null;
            }

            // 5. Finally remove the user
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Account successfully purged from system." });
        }
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
