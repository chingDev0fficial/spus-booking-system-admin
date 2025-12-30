const loginAPI =
  "https://script.google.com/macros/s/AKfycbzRhy-4W6gsO4g37pVx_utTruVawXXU1dOvgruW03CPaFz5U1VU1zU2MXsjSRZK1ImS5g/exec";

// Toggle password visibility
document
  .getElementById("togglePassword")
  .addEventListener("click", function () {
    const passwordInput = document.getElementById("password");
    const type =
      passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    this.textContent = type === "password" ? "👁️" : "👁️‍🗨️";
  });

// Handle form submission
document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const rememberMe = document.getElementById("rememberMe").checked;
    const loginBtn = document.getElementById("loginBtn");
    const errorMessage = document.getElementById("errorMessage");

    // Hide previous error
    errorMessage.classList.remove("show");
    errorMessage.textContent = "";

    // Show loading state
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Logging in...';

    try {
      // Build API URL with credentials
      const url = new URL(loginAPI);
      url.searchParams.append("username", username);
      url.searchParams.append("password", password);

      console.log("Attempting login...");

      const response = await fetch(url.toString());
      const result = await response.json();

      console.log("Login response:", result);

      if (result.success) {
        // Store admin session
        sessionStorage.setItem(
          "adminAuth",
          JSON.stringify({
            username: result.username,
            role: result.role,
            loginTime: new Date().toISOString(),
          })
        );

        // Store in localStorage if "Remember me" is checked
        if (rememberMe) {
          localStorage.setItem(
            "adminAuth",
            JSON.stringify({
              username: result.username,
              role: result.role,
            })
          );
        }

        // Show success and redirect
        loginBtn.innerHTML = "✓ Login Successful!";
        loginBtn.style.background =
          "linear-gradient(135deg, #27ae60 0%, #229954 100%)";

        setTimeout(() => {
          window.location.href = "admin_dashboard.html";
        }, 1000);
      } else {
        // Show error message
        errorMessage.textContent =
          result.message || "Invalid username or password";
        errorMessage.classList.add("show");

        // Reset button
        loginBtn.disabled = false;
        loginBtn.innerHTML = "Login";
      }
    } catch (error) {
      console.error("Login error:", error);
      errorMessage.textContent = "Connection error. Please try again.";
      errorMessage.classList.add("show");

      // Reset button
      loginBtn.disabled = false;
      loginBtn.innerHTML = "Login";
    }
  });

// Check if already logged in
window.addEventListener("DOMContentLoaded", () => {
  const adminAuth =
    sessionStorage.getItem("adminAuth") || localStorage.getItem("adminAuth");

  if (adminAuth) {
    // Already logged in, redirect to dashboard
    window.location.href = "admin_dashboard.html";
  }
});
