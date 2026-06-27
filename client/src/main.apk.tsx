import { createRoot } from "react-dom/client";
import App from "./App.apk";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

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

setTimeout(removeSplash, 3000);
