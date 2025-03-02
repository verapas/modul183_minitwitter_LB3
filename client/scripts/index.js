document.addEventListener("DOMContentLoaded", () => {
  const newTweetInput = document.getElementById("new-tweet");
  const postTweetButton = document.getElementById("post-tweet");
  const logoutButton = document.getElementById("logout");

  // Benutzer aus localStorage laden
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  const generateTweet = (tweet) => {
    const date = new Date(tweet.timestamp).toLocaleDateString("de-CH", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    return `
      <div class="flex flex-col gap-2 w-full">
        <div class="bg-slate-600 rounded p-4 flex gap-4 items-center border-l-4 border-blue-400">
          <img src="./img/tweet.png" alt="SwitzerChees" class="w-14 h-14 rounded-full" />
          <div class="flex flex-col grow">
            <div class="flex justify-between text-gray-200">
              <h3 class="font-semibold">${tweet.username}</h3>
              <p class="text-sm">${date}</p>
            </div>
            <p>${tweet.text}</p>
          </div>
        </div>
      </div>
    `;
  };

  const getFeed = async () => {
    const token = user.token;
    try {
      const response = await fetch("/api/feed", {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const tweets = await response.json();
        if (Array.isArray(tweets)) {
          document.getElementById("feed").innerHTML = tweets.map(generateTweet).join("");
        } else {
          console.error("Feed is not an array:", tweets);
        }
      } else {
        console.error("Fehler beim Abrufen des Feeds:", response.statusText);
      }
    } catch (err) {
      console.error("Fehler in getFeed:", err);
    }
  };

  const postTweet = async () => {
    const text = newTweetInput.value;
    if (!text.trim()) return;
    await fetch("/api/feed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${user.token}`
      },
      body: JSON.stringify({ text }),  // Nur der Text wird gesendet
    });
    await getFeed();
    newTweetInput.value = "";
  };

  postTweetButton.addEventListener("click", postTweet);
  newTweetInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      postTweet();
    }
  });

  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("user");
    window.location.href = "/login.html";
  });

  getFeed();
});
