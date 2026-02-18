document.addEventListener("DOMContentLoaded", () => {
  const loginAPI =
    "https://script.google.com/macros/s/AKfycbzRhy-4W6gsO4g37pVx_utTruVawXXU1dOvgruW03CPaFz5U1VU1zU2MXsjSRZK1ImS5g/exec";

  // Toggle password visibility
  const CUSTOM_EYE = document.getElementById("eyeGroup");
  const SLASH = document.getElementById("slash");
  const PASSWORD_INPUT = document.getElementById("password");
  const SUBMITION = document.getElementById("loginForm");
  let isInputTypePassword = true;

  const handleToggleEye = () => {
    CUSTOM_EYE.classList.toggle("slashed");
    SLASH.style.boxShadow = isInputTypePassword ? "none" : "0 0 0 1px white";

    isInputTypePassword = !isInputTypePassword;

    const type = isInputTypePassword ? "password" : "text";
    PASSWORD_INPUT.setAttribute("type", type);
  };

  const handleFormSubmition = async function (e) {
    e.preventDefault();

    // store credentials
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
      // example api with params
      // url: https://script.google.com/macros/s/AKfycbzRhy-4W6gsO4g37pVx_utTruVawXXU1dOvgruW03CPaFz5U1VU1zU2MXsjSRZK1ImS5g/exec?username={username}&password={password}
      const url = new URL(loginAPI);
      url.searchParams.append("username", username);
      url.searchParams.append("password", password);

      const response = await fetch(url.toString()); // this will return a response object promise
      const result = await response.json(); // this will return a json object promise
      /**
       * exampple result:
       * 
       * {
       *  success: true,
       *  message: "Login successful",
       *  username: "admin",
       *  role: "admin",
       *  loginTime: "2026-02-17T10:00:00.000Z",
       * }
       */

      if (result.success) {
        // Store admin session
        sessionStorage.setItem(
          "adminAuth",
          JSON.stringify({
            username: result.username,
            role: result.role,
            loginTime: new Date().toISOString(),
          }),
        );

        // Store in localStorage if "Remember me" is checked
        if (rememberMe) {
          localStorage.setItem(
            "adminAuth",
            JSON.stringify({
              username: result.username,
              role: result.role,
            }),
          );
        }

        // Show success and redirect
        loginBtn.innerHTML = "✓ Login Successful!"; // this will show a checkmark and the text "Login Successful"
        loginBtn.style.background =
          "linear-gradient(135deg, #27ae60 0%, #229954 100%)";

        setTimeout(() => {
          window.location.href = "admin_dashboard.html"; // this will redirect to the dashboard page
        }, 1000); // 1000 milliseconds = 1 second
      } else { // if the login is not successful
        // Show error message
        errorMessage.textContent =
          result.message || "Invalid username or password"; // initailize the error message
        errorMessage.classList.add("show"); // this will show the error message

        // Reset button
        loginBtn.disabled = false; // this will enable the login button
        loginBtn.innerHTML = "Login"; // this will reset the login button to the original text "Login"
      }
    } catch (error) {
      console.error("Login error:", error);
      errorMessage.textContent = "Connection error. Please try again."; // this will initialize the error message
      errorMessage.classList.add("show"); // this will show the error message

      // Reset button
      loginBtn.disabled = false; // this will enable the login button
      loginBtn.innerHTML = "Login"; // this will reset the login button to the original text "Login"
    }
  };

  CUSTOM_EYE.addEventListener("click", handleToggleEye); // this will add an event listener to the eye icon to toggle the password visibility
  SUBMITION.addEventListener("submit", handleFormSubmition); // this will add an event listener to the form to submit the form

  const adminAuth =
    sessionStorage.getItem("adminAuth") || localStorage.getItem("adminAuth"); // this will check if the user is already logged in

  if (adminAuth) {
    // Already logged in, redirect to dashboard
    window.location.href = "admin_dashboard.html";
  }
});
