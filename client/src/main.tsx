import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // When a new SW installs while an old one is active, reload the page
        // so the new SW immediately takes full control and serves fresh HTML.
        // This breaks the stale-HTML cache cycle that causes permanent splash lockup.
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              // New SW is now in control — reload to get fresh HTML
              window.location.reload();
            }
          });
        });
      })
      .catch(() => {
        // SW registration failed silently — app still works without it
      });

    // Also reload if the controlling SW changes (e.g. another tab triggered skipWaiting)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  });
}

// Render React app
const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Fade out splash after first paint
function removeSplash() {
  const splash = document.getElementById("splash");
  if (splash && !splash.classList.contains("fade-out")) {
    splash.classList.add("fade-out");
    setTimeout(() => splash.remove(), 450);
  }
}

requestAnimationFrame(() => {
  requestAnimationFrame(removeSplash);
});

// Hard safety net — never let the splash stay longer than 3 seconds,
// even if React rendering is blocked or the module partially failed.
setTimeout(removeSplash, 3000);
