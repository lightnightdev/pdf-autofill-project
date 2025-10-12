using Microsoft.AspNetCore.Mvc;
using autofillApi.Models;
using autofillApi.Helpers;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Authorization;

namespace autofillApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly JwtHelper _jwtHelper;

        // You can replace this with a proper user store (DB)
        private readonly Dictionary<string, string> _users = new()
        {
            { "admin", "Water Dread 23" }, // plain-text for example only
            { "demo", "Password123" }
        };

        public AuthController(IConfiguration config)
        {
            _jwtHelper = new JwtHelper(config);
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest("Username and password are required.");

            if (!_users.ContainsKey(request.Username) || _users[request.Username] != request.Password)
                return Unauthorized("Invalid credentials.");

            var token = _jwtHelper.GenerateJwtToken(request.Username);

            return Ok(new { token });
        }

        [HttpGet("test")]
        [Authorize]
        public IActionResult TestAuth()
        {
            return Ok(new { message = "You are authorized!" });
        }
    }
}
