const APP_URL = "https://jarvis-ji.streamlit.app/";

document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("fullscreenBtn").addEventListener("click", () => {
  window.open(APP_URL, "_blank", "noopener,noreferrer");
});

// Iframes do not expose reliable cross-origin load errors. Keep a direct-launch
// path visible through the toolbar if the Streamlit embed is blocked.
