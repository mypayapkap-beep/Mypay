import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, Lock, Loader2, User, KeyRound,
  CheckCircle2, ShieldCheck, ArrowLeft,
} from "lucide-react";
import { sendFirebaseOtp, getOtpErrorMessage, type OtpSession } from "@/lib/firebaseOtp";

type Tab = "login" | "register" | "forgot";
type RegStep = "mobile" | "otp" | "details";
type ForgotStep = "mobile" | "otp" | "password";

const _apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

async function authFetch(path: string, body: object) {
  const res = await fetch(`${_apiBase}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as {
    success: boolean;
    session: { accessToken: string; refreshToken: string; expiresAt: number };
    user: { name: string };
  };
}

export default function LoginPage() {
  const { toast } = useToast();
  const { login } = useAuthContext();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);

  // ── Login ────────────────────────────────────────────────────────────────
  const [loginForm, setLoginForm] = useState({ mobile: "", password: "" });
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  // ── Register ─────────────────────────────────────────────────────────────
  const [regStep, setRegStep] = useState<RegStep>("mobile");
  const [regMobile, setRegMobile] = useState("");
  const [regOtp, setRegOtp] = useState("");
  const [regForm, setRegForm] = useState({ name: "", password: "", confirmPassword: "", referralCode: "" });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [referralLocked, setReferralLocked] = useState(false);
  const [regOtpSession, setRegOtpSession] = useState<OtpSession | null>(null);
  const [regResendSecs, setRegResendSecs] = useState(0);

  // ── Forgot Password ───────────────────────────────────────────────────────
  const [forgotStep, setForgotStep] = useState<ForgotStep>("mobile");
  const [forgotMobile, setForgotMobile] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotForm, setForgotForm] = useState({ password: "", confirmPassword: "" });
  const [forgotErrors, setForgotErrors] = useState<Record<string, string>>({});
  const [forgotOtpSession, setForgotOtpSession] = useState<OtpSession | null>(null);
  const [forgotResendSecs, setForgotResendSecs] = useState(0);

  useEffect(() => {
    if (regResendSecs <= 0) return;
    const t = setTimeout(() => setRegResendSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [regResendSecs]);

  useEffect(() => {
    if (forgotResendSecs <= 0) return;
    const t = setTimeout(() => setForgotResendSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [forgotResendSecs]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const ref = params.get("ref");
    if (ref) {
      setRegForm((f) => ({ ...f, referralCode: ref }));
      setReferralLocked(true);
      setTab("register");
    }
  }, [search]);

  // ── Reset helpers ─────────────────────────────────────────────────────────
  function resetRegFlow() {
    setRegStep("mobile");
    setRegMobile("");
    setRegOtp("");
    setRegForm((f) => ({ ...f, name: "", password: "", confirmPassword: "" }));
    setRegErrors({});
    setRegOtpSession(null);
    setRegResendSecs(0);
    setLoading(false);
  }

  function resetForgotFlow() {
    setForgotStep("mobile");
    setForgotMobile("");
    setForgotOtp("");
    setForgotForm({ password: "", confirmPassword: "" });
    setForgotErrors({});
    setForgotOtpSession(null);
    setForgotResendSecs(0);
    setLoading(false);
  }

  // ── Login handler ─────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!loginForm.mobile.trim()) errs.mobile = "Mobile number is required";
    if (!loginForm.password) errs.password = "Password is required";
    if (Object.keys(errs).length) { setLoginErrors(errs); return; }
    setLoginErrors({});
    setLoading(true);
    try {
      const data = await authFetch("/login", {
        mobile: loginForm.mobile.trim(),
        password: loginForm.password,
      });
      login(data.session.accessToken, data.session.refreshToken);
      toast({ title: "Welcome back!" });
      navigate("/app/dashboard");
    } catch (err: any) {
      toast({ title: err.message ?? "Login failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Register: Step 1 — Send OTP ───────────────────────────────────────────
  const handleRegSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!regMobile.trim() || regMobile.trim().length < 10) errs.mobile = "Enter a valid 10-digit mobile number";
    if (Object.keys(errs).length) { setRegErrors(errs); return; }
    setRegErrors({});
    setLoading(true);
    try {
      const session = await sendFirebaseOtp(regMobile.trim(), "reg-recaptcha-container", "signup");
      setRegOtpSession(session);
      setRegStep("otp");
      setRegResendSecs(30);
      toast({ title: "OTP sent to your number" });
    } catch (err: unknown) {
      toast({ title: getOtpErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Register: Step 2 — Verify OTP ────────────────────────────────────────
  const handleRegVerifyOtp = async () => {
    if (regOtp.length !== 6) { setRegErrors({ otp: "Enter the 6-digit OTP" }); return; }
    if (!regOtpSession) {
      toast({ title: "Session expired. Please start again.", variant: "destructive" });
      resetRegFlow();
      return;
    }
    setRegErrors({});
    setLoading(true);
    try {
      await regOtpSession.confirmFn(regOtp);
      setRegStep("details");
    } catch (err: unknown) {
      setRegErrors({ otp: getOtpErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  // ── Register: Step 3 — Create Account ────────────────────────────────────
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!regForm.name.trim()) errs.name = "Name is required";
    if (!regForm.password) errs.password = "Password is required";
    else if (regForm.password.length < 6) errs.password = "Password must be at least 6 characters";
    if (!regForm.confirmPassword) errs.confirmPassword = "Please confirm your password";
    else if (regForm.password !== regForm.confirmPassword) errs.confirmPassword = "Passwords do not match";
    if (Object.keys(errs).length) { setRegErrors(errs); return; }
    setRegErrors({});
    setLoading(true);
    try {
      const data = await authFetch("/register", {
        name: regForm.name.trim(),
        mobile: regMobile.trim(),
        password: regForm.password,
        confirmPassword: regForm.confirmPassword,
        referralCode: regForm.referralCode.trim() || undefined,
      });
      login(data.session.accessToken, data.session.refreshToken);
      toast({ title: "Account created! Welcome to MyPay!" });
      navigate("/install");
    } catch (err: any) {
      const msg: string = err.message ?? "Registration failed";
      toast({ title: msg, variant: "destructive" });
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("mobile number")) {
        resetRegFlow();
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot: Step 1 — Send OTP ─────────────────────────────────────────────
  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!forgotMobile.trim() || forgotMobile.trim().length < 10) errs.mobile = "Enter a valid 10-digit mobile number";
    if (Object.keys(errs).length) { setForgotErrors(errs); return; }
    setForgotErrors({});
    setLoading(true);
    try {
      const session = await sendFirebaseOtp(forgotMobile.trim(), "forgot-recaptcha-container", "password-reset");
      setForgotOtpSession(session);
      setForgotStep("otp");
      setForgotResendSecs(30);
      toast({ title: "OTP sent to your number" });
    } catch (err: unknown) {
      toast({ title: getOtpErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot: Step 2 — Verify OTP ──────────────────────────────────────────
  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.length !== 6) { setForgotErrors({ otp: "Enter the 6-digit OTP" }); return; }
    if (!forgotOtpSession) {
      toast({ title: "Session expired. Please start again.", variant: "destructive" });
      resetForgotFlow();
      return;
    }
    setForgotErrors({});
    setLoading(true);
    try {
      await forgotOtpSession.confirmFn(forgotOtp);
      setForgotStep("password");
    } catch (err: unknown) {
      setForgotErrors({ otp: getOtpErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot: Step 3 — Reset Password ──────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!forgotForm.password) errs.password = "Password is required";
    else if (forgotForm.password.length < 6) errs.password = "Password must be at least 6 characters";
    if (!forgotForm.confirmPassword) errs.confirmPassword = "Please confirm your password";
    else if (forgotForm.password !== forgotForm.confirmPassword) errs.confirmPassword = "Passwords do not match";
    if (Object.keys(errs).length) { setForgotErrors(errs); return; }
    setForgotErrors({});
    setLoading(true);
    try {
      await authFetch("/reset-password", {
        mobile: forgotMobile.trim(),
        newPassword: forgotForm.password,
        confirmPassword: forgotForm.confirmPassword,
      });
      toast({ title: "Password reset! Please sign in with your new password." });
      resetForgotFlow();
      setTab("login");
    } catch (err: any) {
      toast({ title: err.message ?? "Password reset failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicators ───────────────────────────────────────────────────────
  const regStepIndex = regStep === "mobile" ? 0 : regStep === "otp" ? 1 : 2;
  const regSteps = ["Mobile", "Verify OTP", "Account"];

  const forgotStepIndex = forgotStep === "mobile" ? 0 : forgotStep === "otp" ? 1 : 2;
  const forgotSteps = ["Mobile", "Verify OTP", "New Password"];

  function StepBar({ steps, current }: { steps: string[]; current: number }) {
    return (
      <div className="flex items-center justify-between mb-6">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                i < current
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === current
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground bg-background"
              }`}>
                {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs mt-1 ${i === current ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 ${i < current ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-white font-semibold text-lg">MyPay</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Earn, Save &<br />Transfer — Faster.
          </h1>
          <p className="text-primary-foreground/70 text-lg">
            Complete tasks, earn rewards, and manage your money in one place.
          </p>
        </div>
        <div className="flex gap-8">
          <div>
            <p className="text-2xl font-bold text-white">₹200</p>
            <p className="text-primary-foreground/60 text-sm">Referral bonus</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">3-level</p>
            <p className="text-primary-foreground/60 text-sm">Referral network</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">Instant</p>
            <p className="text-primary-foreground/60 text-sm">UPI withdrawals</p>
          </div>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">M</span>
            </div>
            <span className="font-semibold text-lg text-foreground">MyPay</span>
          </div>

          {/* Tab bar — hidden in forgot flow */}
          {tab !== "forgot" && (
            <div className="flex rounded-lg border border-border p-1 mb-8 bg-muted">
              <button
                type="button"
                onClick={() => { setTab("login"); resetRegFlow(); }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${tab === "login" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setTab("register")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${tab === "register" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* ── Sign In ── */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="9876543210"
                    className="pl-10"
                    value={loginForm.mobile}
                    onChange={(e) => setLoginForm((f) => ({ ...f, mobile: e.target.value }))}
                    autoComplete="tel"
                  />
                </div>
                {loginErrors.mobile && <p className="text-destructive text-xs mt-1">{loginErrors.mobile}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-foreground">Password</label>
                  <button
                    type="button"
                    onClick={() => { resetForgotFlow(); setTab("forgot"); }}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="current-password"
                  />
                </div>
                {loginErrors.password && <p className="text-destructive text-xs mt-1">{loginErrors.password}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button type="button" onClick={() => setTab("register")} className="text-primary font-medium hover:underline">
                  Create one
                </button>
              </p>
            </form>
          )}

          {/* ── Create Account ── */}
          {tab === "register" && (
            <div>
              <StepBar steps={regSteps} current={regStepIndex} />

              {/* Step 1: Mobile */}
              {regStep === "mobile" && (
                <form onSubmit={handleRegSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Mobile Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="9876543210"
                        className="pl-10"
                        maxLength={10}
                        value={regMobile}
                        onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, ""))}
                        autoComplete="tel"
                      />
                    </div>
                    {regErrors.mobile && <p className="text-destructive text-xs mt-1">{regErrors.mobile}</p>}
                    <p className="text-xs text-muted-foreground mt-1">We'll send an OTP to verify this number.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Referral Code{" "}
                      {referralLocked ? (
                        <span className="text-emerald-600 font-medium text-xs inline-flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Applied
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      )}
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Enter referral code"
                        value={regForm.referralCode}
                        readOnly={referralLocked}
                        onChange={(e) => {
                          if (!referralLocked) setRegForm((f) => ({ ...f, referralCode: e.target.value }));
                        }}
                        className={referralLocked ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-mono font-semibold cursor-not-allowed" : ""}
                      />
                      {referralLocked && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    {referralLocked && (
                      <p className="text-xs text-emerald-600 mt-1">Referral code from your invite link — locked in.</p>
                    )}
                  </div>

                  <div id="reg-recaptcha-container" />

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
                    Send OTP
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <button type="button" onClick={() => setTab("login")} className="text-primary font-medium hover:underline">
                      Sign in
                    </button>
                  </p>
                </form>
              )}

              {/* Step 2: OTP */}
              {regStep === "otp" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">OTP sent to your number</p>

                  <div>
                    <label className="text-sm font-medium">Enter OTP</label>
                    <Input
                      type="tel"
                      placeholder="• • • • • •"
                      maxLength={6}
                      className="mt-1 font-mono text-center text-xl tracking-[0.5em]"
                      value={regOtp}
                      onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ""))}
                      autoComplete="one-time-code"
                      autoFocus
                    />
                    {regErrors.otp && <p className="text-destructive text-xs mt-1">{regErrors.otp}</p>}
                  </div>

                  {regOtpSession?.devOtp && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm font-mono font-semibold text-amber-800">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
                      OTP: {regOtpSession.devOtp}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => { setRegStep("mobile"); setRegOtp(""); setRegErrors({}); setRegOtpSession(null); setRegResendSecs(0); }}
                      disabled={regResendSecs > 0}
                      className="flex-1"
                    >
                      {regResendSecs > 0 ? `Resend in ${regResendSecs}s` : "Back"}
                    </Button>
                    <Button onClick={handleRegVerifyOtp} disabled={loading || regOtp.length !== 6} className="flex-1">
                      {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Verify
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Account details */}
              {regStep === "details" && (
                <form onSubmit={handleCreateAccount} className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span>+91 {regMobile} verified successfully</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Your full name"
                        className="pl-10"
                        value={regForm.name}
                        onChange={(e) => setRegForm((f) => ({ ...f, name: e.target.value }))}
                        autoComplete="name"
                      />
                    </div>
                    {regErrors.name && <p className="text-destructive text-xs mt-1">{regErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Min. 6 characters"
                        className="pl-10"
                        value={regForm.password}
                        onChange={(e) => setRegForm((f) => ({ ...f, password: e.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>
                    {regErrors.password && <p className="text-destructive text-xs mt-1">{regErrors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Confirm Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Re-enter your password"
                        className="pl-10"
                        value={regForm.confirmPassword}
                        onChange={(e) => setRegForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>
                    {regErrors.confirmPassword && <p className="text-destructive text-xs mt-1">{regErrors.confirmPassword}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ── Forgot Password ── */}
          {tab === "forgot" && (
            <div>
              <button
                type="button"
                onClick={() => { resetForgotFlow(); setTab("login"); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>

              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground">Reset Password</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We'll verify your number via OTP before resetting your password.
                </p>
              </div>

              <StepBar steps={forgotSteps} current={forgotStepIndex} />

              {/* Step 1: Mobile */}
              {forgotStep === "mobile" && (
                <form onSubmit={handleForgotSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Registered Mobile Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="9876543210"
                        className="pl-10"
                        maxLength={10}
                        value={forgotMobile}
                        onChange={(e) => setForgotMobile(e.target.value.replace(/\D/g, ""))}
                        autoComplete="tel"
                      />
                    </div>
                    {forgotErrors.mobile && <p className="text-destructive text-xs mt-1">{forgotErrors.mobile}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Enter the mobile number linked to your account.</p>
                  </div>

                  <div id="forgot-recaptcha-container" />

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
                    Send OTP
                  </Button>
                </form>
              )}

              {/* Step 2: OTP */}
              {forgotStep === "otp" && (
                <form onSubmit={handleForgotVerifyOtp} className="space-y-4">
                  <div className="text-center mb-2">
                    <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      OTP sent to <span className="font-semibold text-foreground">+91 {forgotMobile}</span>
                    </p>
                  </div>

                  {forgotOtpSession?.mode === "dev" && forgotOtpSession.devOtp && (
                    <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-3 py-2 font-mono">
                      <span className="shrink-0 font-semibold">[DEV]</span>
                      <span>Your OTP: <strong className="text-lg tracking-widest">{forgotOtpSession.devOtp}</strong></span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Enter OTP</label>
                    <Input
                      type="tel"
                      placeholder="6-digit OTP"
                      maxLength={6}
                      className="text-center text-xl tracking-widest font-mono"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                      autoComplete="one-time-code"
                    />
                    {forgotErrors.otp && <p className="text-destructive text-xs mt-1">{forgotErrors.otp}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading || forgotOtp.length !== 6}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Verify OTP
                  </Button>

                  <div className="text-center text-sm text-muted-foreground">
                    {forgotResendSecs > 0 ? (
                      <span className="text-muted-foreground">
                        Resend OTP in{" "}
                        <span className="font-semibold tabular-nums text-foreground">{forgotResendSecs}s</span>
                      </span>
                    ) : (
                      <span>
                        Didn't receive it?{" "}
                        <button
                          type="button"
                          className="text-primary font-medium hover:underline"
                          onClick={() => { setForgotStep("mobile"); setForgotOtp(""); setForgotErrors({}); setForgotOtpSession(null); setForgotResendSecs(0); }}
                        >
                          Go back &amp; resend
                        </button>
                      </span>
                    )}
                  </div>
                </form>
              )}

              {/* Step 3: New Password */}
              {forgotStep === "password" && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span>+91 {forgotMobile} verified successfully</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Min. 6 characters"
                        className="pl-10"
                        value={forgotForm.password}
                        onChange={(e) => setForgotForm((f) => ({ ...f, password: e.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>
                    {forgotErrors.password && <p className="text-destructive text-xs mt-1">{forgotErrors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Confirm New Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Re-enter your new password"
                        className="pl-10"
                        value={forgotForm.confirmPassword}
                        onChange={(e) => setForgotForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>
                    {forgotErrors.confirmPassword && <p className="text-destructive text-xs mt-1">{forgotErrors.confirmPassword}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Reset Password
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
