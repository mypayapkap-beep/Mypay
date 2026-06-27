import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwaInstallEvent: BeforeInstallPromptEvent | null;
  }
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

// Read event captured by the early inline script in index.html (before React mounted).
// Falls back to null if the event hasn't fired yet.
function getEarlyPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window !== "undefined" && window.__pwaInstallEvent) {
    return window.__pwaInstallEvent;
  }
  return null;
}

export function usePWA(): PWAState {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(getEarlyPrompt);

  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    );
  });

  const isIOS =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window.navigator as { standalone?: boolean }).standalone;

  const isAndroid =
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  useEffect(() => {
    if (isInstalled) return;

    // Handler for events that fire AFTER React mounts
    const handleNativePrompt = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      window.__pwaInstallEvent = prompt;
      setDeferredPrompt(prompt);
    };

    // Also listen for the custom event dispatched by our early script
    const handlePwaReady = () => {
      if (window.__pwaInstallEvent) {
        setDeferredPrompt(window.__pwaInstallEvent);
      }
    };

    window.addEventListener("beforeinstallprompt", handleNativePrompt);
    window.addEventListener("pwa-install-ready", handlePwaReady);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__pwaInstallEvent = null;
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleNativePrompt);
      window.removeEventListener("pwa-install-ready", handlePwaReady);
    };
  }, [isInstalled]);

  const promptInstall = async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    const prompt = deferredPrompt ?? getEarlyPrompt();
    if (!prompt) return "unavailable";
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__pwaInstallEvent = null;
    setDeferredPrompt(null);
    return outcome;
  };

  return {
    isInstallable: deferredPrompt !== null,
    isInstalled,
    isIOS,
    isAndroid,
    promptInstall,
  };
}
