document.addEventListener("DOMContentLoaded", () => {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginButton = document.getElementById("login");
  const errorText = document.getElementById("error");

  loginButton.addEventListener("click", async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (data?.token) {
      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = "/";
    } else if (data?.error) {
      errorText.innerText = data.error;
    } else {
      errorText.innerText = "Unbekannter Fehler";
    }
  });

});
