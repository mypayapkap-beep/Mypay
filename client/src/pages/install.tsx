import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { usePWA } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import {
  Download,
  Share,
  Plus,
  ChevronRight,
  CheckCircle2,
  Smartphone,
  Zap,
  Shield,
  ArrowRight,
  MoreVertical,
  Package,
} from "lucide-react";

const APK_DOWNLOAD_URL = import.meta.env.VITE_APK_DOWNLOAD_URL as string | undefined;

export default function InstallPage() {
  const [, navigate] = useLocation();
  const { isInstallable, isInstalled, isIOS, isAndroid, promptInstall } = usePWA();
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    if (isInstalled) {
      setInstalled(true);
    }
  }, [isInstalled]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowManualGuide(true);
      return;
    }

    if (isInstallable) {
      setInstalling(true);
      const outcome = await promptInstall();
      setInstalling(false);
      if (outcome === "accepted") {
        setInstalled(true);
      }
      return;
    }

    setShowManualGuide(true);
  };

  const handleSkip = () => {
    navigate("/app/dashboard");
  };

  if (installed) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-2xl bg-green-500 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 text-center">MyPay Installed!</h1>
        <p className="text-slate-400 text-center mb-8">
          Open MyPay from your home screen for the best experience.
        </p>
        <Button
          className="w-full max-w-xs bg-white text-[#0f172a] hover:bg-slate-100 font-semibold"
          onClick={handleSkip}
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 pb-0">
        {/* App icon */}
        <div className="w-24 h-24 rounded-[22px] bg-[#1e3a8a] flex items-center justify-center mb-5 shadow-2xl">
          <span className="text-white font-extrabold text-4xl">M</span>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
          Download MyPay
        </h1>
        <p className="text-slate-400 text-center text-sm mb-8 max-w-xs">
          Install the native Android app for the best experience — no browser required.
        </p>

        {/* Feature list */}
        <div className="w-full max-w-xs space-y-3 mb-8">
          {[
            { icon: Zap, text: "Instant access from your home screen" },
            { icon: Smartphone, text: "Full-screen native app experience" },
            { icon: Shield, text: "Fast, secure, always available" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-slate-300 text-sm">{text}</span>
            </div>
          ))}
        </div>

        {!showManualGuide && (
          <div className="w-full max-w-xs space-y-3">
            {/* Primary CTA: Android native APK download */}
            {APK_DOWNLOAD_URL ? (
              <a href={APK_DOWNLOAD_URL} download="MyPay.apk" className="block">
                <Button className="w-full bg-white text-[#0f172a] hover:bg-slate-100 font-bold h-12 text-base shadow-lg">
                  <Package className="w-5 h-5 mr-2" />
                  Download MyPay APK
                </Button>
              </a>
            ) : (
              /* PWA install fallback when no APK URL is set */
              <Button
                className="w-full bg-white text-[#0f172a] hover:bg-slate-100 font-bold h-12 text-base"
                onClick={handleInstall}
                disabled={installing}
              >
                {installing ? (
                  "Installing…"
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    {isIOS ? "Add to Home Screen" : "Install App"}
                  </>
                )}
              </Button>
            )}

            {/* Secondary: PWA install when APK URL exists and on Android */}
            {APK_DOWNLOAD_URL && isAndroid && (
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10 font-medium h-11"
                onClick={handleInstall}
                disabled={installing}
              >
                {installing ? "Installing…" : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    {isInstallable ? "Add to Home Screen Instead" : "Install via Browser"}
                  </>
                )}
              </Button>
            )}

            <button
              type="button"
              className="w-full text-slate-500 text-sm py-2 hover:text-slate-300 transition-colors"
              onClick={handleSkip}
            >
              Skip for now
            </button>
          </div>
        )}
      </div>

      {/* Manual install guide */}
      {showManualGuide && (
        <div className="mx-4 mb-6 mt-4 rounded-2xl bg-white/10 border border-white/10 p-5">
          <h2 className="text-white font-bold text-base mb-4">
            {isIOS ? "Add to Home Screen (iOS)" : "How to Install on Android"}
          </h2>

          {isIOS ? (
            <ol className="space-y-4">
              {[
                { icon: Share, label: "Tap the Share icon", sub: "Bottom bar in Safari" },
                { icon: Plus, label: 'Tap "Add to Home Screen"', sub: "Scroll down in the share sheet" },
                { icon: CheckCircle2, label: 'Tap "Add"', sub: "MyPay appears on your home screen" },
              ].map(({ icon: Icon, label, sub }, i) => (
                <li key={label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{label}</p>
                    <p className="text-slate-400 text-xs">{sub}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="space-y-4">
              {[
                { Icon: MoreVertical, label: "Tap the Chrome menu", sub: "Three dots (⋮) in the top-right corner" },
                { Icon: Download, label: '"Add to Home screen"', sub: "Tap this option in the menu" },
                { Icon: CheckCircle2, label: 'Tap "Add"', sub: "MyPay icon appears on your home screen" },
              ].map(({ Icon, label, sub }, i) => (
                <li key={label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{label}</p>
                    <p className="text-slate-400 text-xs">{sub}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <button
            type="button"
            className="mt-5 w-full text-slate-400 text-sm flex items-center justify-center gap-1 hover:text-white transition-colors"
            onClick={handleSkip}
          >
            Continue to dashboard
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {showManualGuide && (
        <div className="px-4 pb-8">
          <div className="h-px bg-white/10 mb-6" />
          <button
            type="button"
            className="w-full text-slate-500 text-sm"
            onClick={handleSkip}
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
