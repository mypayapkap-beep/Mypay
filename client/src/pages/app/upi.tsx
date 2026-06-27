import AppLayout from "@/components/AppLayout";
import { useGetUpiAccounts, useDeleteUpiAccount, getGetUpiAccountsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth";
import { sendFirebaseOtp, getOtpErrorMessage, type OtpSession } from "@/lib/firebaseOtp";
import {
  Loader2, Plus, Trash2, CreditCard, CheckCircle2, ChevronRight,
  Smartphone, ArrowDownToLine, ShieldCheck, RefreshCw,
} from "lucide-react";
import { useState, useEffect } from "react";
import { ProviderLogo, PROVIDER_INFO } from "@/components/ProviderLogo";

// ── Provider definitions ───────────────────────────────────────────────────

const BUY_PROVIDERS = [
  { id: "paytm" as const, suffix: "@paytm" },
  { id: "mobikwik" as const, suffix: "@ikwik" },
  { id: "freecharge" as const, suffix: "@freecharge" },
];
type BuyProviderId = typeof BUY_PROVIDERS[number]["id"];

const SELL_PROVIDERS = [
  { id: "paytm" as const, suffix: "@paytm" },
  { id: "mobikwik" as const, suffix: "@ikwik" },
  { id: "phonepe" as const, suffix: "@ybl" },
  { id: "airtel" as const, suffix: "@airtel" },
  { id: "navi" as const, suffix: "@naviaxis" },
];
type SellProviderId = typeof SELL_PROVIDERS[number]["id"];

// ── Types ──────────────────────────────────────────────────────────────────

type BuyStep = "select-provider" | "enter-mobile" | "enter-otp" | "confirm";
type SellStep = "select-provider" | "enter-mobile" | "enter-otp" | "confirm";

interface SellUpiAccount {
  id: string;
  upiId: string;
  accountHolderName: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const _apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  return fetch(`${_apiBase}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
    return d as T;
  });
}

function friendlyOtpError(e: unknown): string {
  const code: string = (e as any)?.code ?? "";
  if (code === "auth/unauthorized-domain") return "Error: auth/unauthorized-domain — add this domain in Firebase Console → Authentication → Authorized Domains.";
  if (code === "auth/operation-not-allowed") return "Error: auth/operation-not-allowed — enable Phone sign-in in Firebase Console.";
  if (code === "auth/captcha-check-failed") return "Error: auth/captcha-check-failed — reCAPTCHA failed. Please refresh and try again.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please try again later.";
  if (code === "auth/quota-exceeded") return "Error: auth/quota-exceeded — SMS quota exceeded.";
  if (code === "auth/invalid-phone-number") return "Invalid phone number. Enter a 10-digit Indian number.";
  if (code === "auth/missing-phone-number") return "Error: auth/missing-phone-number.";
  if (code) return `OTP failed (${code}). Please try again.`;
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (msg.includes("invalid") || msg.includes("wrong") || msg.includes("incorrect")) return "Invalid OTP. Please try again.";
  if (msg.includes("expired") || msg.includes("timeout")) return "OTP expired. Please request a new one.";
  if (msg.includes("network") || msg.includes("fetch")) return "Network error. Check your connection and try again.";
  return "OTP verification failed. Please try again.";
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepBar({ labels, current }: { labels: string[]; current: number }) {
  return (
    <div className="flex items-center gap-1 mb-2">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-1 flex-1">
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i <= current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {i + 1}
          </div>
          {i < labels.length - 1 && (
            <div className={`flex-1 h-0.5 ${i < current ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── OTP Banner (dev only) ──────────────────────────────────────────────────

function DevOtpBanner({ otp }: { otp: string | null }) {
  if (!otp) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm font-mono font-semibold text-amber-800">
      <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
      OTP: {otp}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

const WIZARD_LABELS = ["Select App", "Mobile", "OTP", "Confirm"];

export default function UpiPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Buy UPI state ──────────────────────────────────────────────────────

  const [showWizard, setShowWizard] = useState(false);
  const { data: upiData, isLoading } = useGetUpiAccounts();
  const deleteUpi = useDeleteUpiAccount();

  const [buyStep, setBuyStep] = useState<BuyStep>("select-provider");
  const [buyProvider, setBuyProvider] = useState<BuyProviderId | null>(null);
  const [buyMobile, setBuyMobile] = useState("");
  const [buyOtp, setBuyOtp] = useState("");
  const [buyDevOtp, setBuyDevOtp] = useState<string | null>(null);
  const [buyOtpSession, setBuyOtpSession] = useState<OtpSession | null>(null);
  const [buyResendSecs, setBuyResendSecs] = useState(0);
  const [buyGeneratedUpiId, setBuyGeneratedUpiId] = useState<string | null>(null);
  const [buyHolderName, setBuyHolderName] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);

  const invalidateBuy = () => queryClient.invalidateQueries({ queryKey: getGetUpiAccountsQueryKey() });

  const resetWizard = () => {
    setBuyStep("select-provider");
    setBuyProvider(null);
    setBuyMobile("");
    setBuyOtp("");
    setBuyDevOtp(null);
    setBuyOtpSession(null);
    setBuyResendSecs(0);
    setBuyGeneratedUpiId(null);
    setBuyHolderName("");
    setBuyLoading(false);
  };

  const openWizard = () => { resetWizard(); setShowWizard(true); };

  const handleBuySendOtp = async () => {
    if (buyMobile.length < 10) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    setBuyLoading(true);
    try {
      const session = await sendFirebaseOtp(buyMobile, "buy-recaptcha-container", "buy-upi");
      setBuyOtpSession(session);
      setBuyDevOtp(session.devOtp ?? null);
      setBuyResendSecs(30);
      setBuyStep("enter-otp");
      toast({ title: "OTP sent to your mobile number" });
    } catch (e: unknown) {
      toast({ title: getOtpErrorMessage(e), variant: "destructive" });
    } finally {
      setBuyLoading(false);
    }
  };

  const handleBuyVerifyOtp = async () => {
    if (buyOtp.length !== 6) {
      toast({ title: "Enter the 6-digit OTP", variant: "destructive" });
      return;
    }
    if (!buyOtpSession) {
      toast({ title: "Session expired. Please start again.", variant: "destructive" });
      return;
    }
    setBuyLoading(true);
    try {
      await buyOtpSession.confirmFn(buyOtp);
      const providerData = BUY_PROVIDERS.find(p => p.id === buyProvider)!;
      setBuyGeneratedUpiId(`${buyMobile}${providerData.suffix}`);
      setBuyDevOtp(null);
      setBuyStep("confirm");
    } catch (e: unknown) {
      toast({ title: getOtpErrorMessage(e), variant: "destructive" });
    } finally {
      setBuyLoading(false);
    }
  };

  const handleSaveUpi = async () => {
    if (!buyGeneratedUpiId || !buyProvider) return;
    setBuyLoading(true);
    try {
      await authFetch("/upi", {
        method: "POST",
        body: JSON.stringify({ upiId: buyGeneratedUpiId, accountHolderName: buyHolderName || buyMobile, provider: buyProvider }),
      });
      toast({ title: "UPI account linked successfully" });
      setShowWizard(false);
      resetWizard();
      invalidateBuy();
    } catch (e: any) {
      toast({ title: e.message ?? "Failed to save. Please try again.", variant: "destructive" });
    } finally {
      setBuyLoading(false);
    }
  };

  const handleDeleteBuy = (id: string) => {
    deleteUpi.mutate({ id }, {
      onSuccess: () => { toast({ title: "UPI account removed" }); invalidateBuy(); },
      onError: () => toast({ title: "Failed to remove account", variant: "destructive" }),
    });
  };

  // ── Sell UPI state ─────────────────────────────────────────────────────

  const [sellStep, setSellStep] = useState<SellStep | null>(null);
  const [sellRelinkId, setSellRelinkId] = useState<string | null>(null);
  const [sellProvider, setSellProvider] = useState<SellProviderId | null>(null);
  const [sellMobile, setSellMobile] = useState("");
  const [sellOtp, setSellOtp] = useState("");
  const [sellDevOtp, setSellDevOtp] = useState<string | null>(null);
  const [sellOtpSession, setSellOtpSession] = useState<OtpSession | null>(null);
  const [sellResendSecs, setSellResendSecs] = useState(0);
  const [sellGeneratedUpiId, setSellGeneratedUpiId] = useState<string | null>(null);
  const [sellHolderName, setSellHolderName] = useState("");
  const [sellLoading, setSellLoading] = useState(false);

  const { data: sellData, isLoading: sellLoading2 } = useQuery({
    queryKey: ["sell-upi"],
    queryFn: () => authFetch<{ accounts: SellUpiAccount[] }>("/sell-upi"),
    staleTime: 30_000,
  });
  const sellAccounts = sellData?.accounts ?? [];

  const saveSellMut = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({
        upiId: sellGeneratedUpiId,
        accountHolderName: sellHolderName || sellMobile,
        provider: sellProvider,
      });
      return sellRelinkId
        ? authFetch<{ success: boolean; account: SellUpiAccount }>(`/sell-upi/${sellRelinkId}`, { method: "PUT", body })
        : authFetch<{ success: boolean; account: SellUpiAccount }>("/sell-upi", { method: "POST", body });
    },
    onSuccess: () => {
      toast({ title: sellRelinkId ? "Sell UPI relinked" : "Sell UPI added" });
      queryClient.invalidateQueries({ queryKey: ["sell-upi"] });
      resetSellFlow();
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed to save. Please try again.", variant: "destructive" }),
  });

  const deleteSellMut = useMutation({
    mutationFn: (id: string) => authFetch<{ success: boolean }>(`/sell-upi/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Sell UPI removed" }); queryClient.invalidateQueries({ queryKey: ["sell-upi"] }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  function resetSellFlow() {
    setSellStep(null);
    setSellRelinkId(null);
    setSellProvider(null);
    setSellMobile("");
    setSellOtp("");
    setSellDevOtp(null);
    setSellOtpSession(null);
    setSellResendSecs(0);
    setSellGeneratedUpiId(null);
    setSellHolderName("");
    setSellLoading(false);
  }

  const openSellWizard = () => { resetSellFlow(); setSellStep("select-provider"); };

  const openSellRelink = (acc: SellUpiAccount) => {
    resetSellFlow();
    setSellRelinkId(acc.id);
    setSellProvider(acc.provider as SellProviderId);
    setSellStep("enter-mobile");
  };

  const handleSellSendOtp = async () => {
    if (sellMobile.length < 10) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    setSellLoading(true);
    try {
      const session = await sendFirebaseOtp(sellMobile, "sell-recaptcha-container", "sell-upi");
      setSellOtpSession(session);
      setSellDevOtp(session.devOtp ?? null);
      setSellResendSecs(30);
      setSellStep("enter-otp");
      toast({ title: "OTP sent to your mobile number" });
    } catch (e: unknown) {
      toast({ title: getOtpErrorMessage(e), variant: "destructive" });
    } finally {
      setSellLoading(false);
    }
  };

  const handleSellVerifyOtp = async () => {
    if (sellOtp.length !== 6) {
      toast({ title: "Enter the 6-digit OTP", variant: "destructive" });
      return;
    }
    if (!sellOtpSession) {
      toast({ title: "Session expired. Please start again.", variant: "destructive" });
      return;
    }
    setSellLoading(true);
    try {
      await sellOtpSession.confirmFn(sellOtp);
      const providerData = SELL_PROVIDERS.find(p => p.id === sellProvider)!;
      setSellGeneratedUpiId(`${sellMobile}${providerData.suffix}`);
      setSellDevOtp(null);
      setSellStep("confirm");
    } catch (e: unknown) {
      toast({ title: getOtpErrorMessage(e), variant: "destructive" });
    } finally {
      setSellLoading(false);
    }
  };

  useEffect(() => {
    if (buyResendSecs <= 0) return;
    const t = setTimeout(() => setBuyResendSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [buyResendSecs]);

  useEffect(() => {
    if (sellResendSecs <= 0) return;
    const t = setTimeout(() => setSellResendSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [sellResendSecs]);

  // ── Derived ────────────────────────────────────────────────────────────

  const buyAccounts = upiData?.accounts ?? [];
  const buyStepIndex = { "select-provider": 0, "enter-mobile": 1, "enter-otp": 2, "confirm": 3 }[buyStep];
  const selectedBuyProviderInfo = buyProvider ? PROVIDER_INFO[buyProvider] : null;

  const sellStepIndex = sellStep ? { "select-provider": 0, "enter-mobile": 1, "enter-otp": 2, "confirm": 3 }[sellStep] : 0;
  const selectedSellProviderInfo = sellProvider ? PROVIDER_INFO[sellProvider] : null;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment</h1>
          <p className="text-sm text-muted-foreground">Manage your UPI accounts for buying and selling</p>
        </div>

        {/* ── Buy UPI Section ── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Buy UPI</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Paytm · MobiKwik · Freecharge · OTP verified</p>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>{buyAccounts.length}</strong> of 4 linked</span>
            </div>
            {buyAccounts.length < 4 && (
              <Button onClick={openWizard} size="sm" data-testid="button-add-upi">
                <Plus className="w-4 h-4 mr-1.5" /> Add UPI
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : buyAccounts.length === 0 ? (
                <div className="p-10 text-center">
                  <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground text-sm font-medium">No UPI accounts linked</p>
                  <p className="text-xs text-muted-foreground mt-1">Add Paytm, MobiKwik, or Freecharge</p>
                  <Button onClick={openWizard} className="mt-4" size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Link UPI Account
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {buyAccounts.map(acc => {
                    const info = PROVIDER_INFO[acc.provider ?? ""];
                    return (
                      <div key={acc.id} className="px-4 py-4 flex items-center gap-3" data-testid={`upi-account-${acc.id}`}>
                        <ProviderLogo provider={acc.provider ?? ""} size={40} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{acc.upiId}</p>
                          <p className="text-xs text-muted-foreground">{info?.name ?? acc.provider} · {acc.accountHolderName}</p>
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded mt-1 inline-block bg-emerald-100 text-emerald-800">
                            Available
                          </span>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive h-8 w-8 shrink-0"
                          onClick={() => handleDeleteBuy(acc.id!)}
                          data-testid={`button-delete-upi-${acc.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground text-center mt-2">Maximum 4 accounts · Paytm, MobiKwik, Freecharge</p>
        </div>

        {/* ── Sell UPI Section ── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownToLine className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Sell UPI</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Paytm · MobiKwik · PhonePe · Airtel Money · Navi · OTP verified</p>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>{sellAccounts.length}</strong> of 5 linked</span>
            </div>
            {sellAccounts.length < 5 && (
              <Button onClick={openSellWizard} size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Add Sell UPI
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {sellLoading2 ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : sellAccounts.length === 0 ? (
                <div className="p-10 text-center">
                  <ArrowDownToLine className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground text-sm font-medium">No Sell UPI accounts linked</p>
                  <p className="text-xs text-muted-foreground mt-1">Add your UPI to receive sell request payments</p>
                  <Button onClick={openSellWizard} className="mt-4" size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Add Sell UPI Account
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {sellAccounts.map((acc: SellUpiAccount) => {
                    const info = PROVIDER_INFO[acc.provider] ?? null;
                    return (
                      <div key={acc.id} className="px-4 py-4 flex items-center gap-3">
                        <ProviderLogo provider={acc.provider} size={40} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono font-semibold truncate">{acc.upiId}</p>
                          <p className="text-xs text-muted-foreground">{info?.name ?? acc.provider} · {acc.accountHolderName}</p>
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded mt-1 inline-block bg-emerald-100 text-emerald-800">
                            Available
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Re-link"
                            onClick={() => openSellRelink(acc)}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm("Remove this Sell UPI?")) deleteSellMut.mutate(acc.id); }}
                            disabled={deleteSellMut.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            {sellAccounts.length > 0 && sellAccounts.length < 5 && (
              <div className="px-4 pb-4">
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={openSellWizard}>
                  <Plus className="w-4 h-4" /> Add Another Sell UPI
                </Button>
              </div>
            )}
          </Card>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 mt-3">
            <p className="font-semibold">Important</p>
            <p>Sell UPI accounts are separate from Buy UPI and used only for sell request payouts.</p>
          </div>
        </div>
      </div>

      {/* ── Sell UPI Wizard Dialog ── */}
      <Dialog open={sellStep !== null} onOpenChange={(o) => { if (!o) resetSellFlow(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{sellRelinkId ? "Re-link Sell UPI Account" : "Add Sell UPI Account"}</DialogTitle>
          </DialogHeader>

          <StepBar labels={WIZARD_LABELS} current={sellStepIndex} />

          {/* Step 1: Select Provider */}
          {sellStep === "select-provider" && (
            <div className="space-y-2.5">
              <p className="text-sm text-muted-foreground">Select your UPI payment app</p>
              {SELL_PROVIDERS.map(p => {
                const info = PROVIDER_INFO[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSellProvider(p.id); setSellStep("enter-mobile"); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary hover:bg-muted/50 transition-colors text-left"
                  >
                    <ProviderLogo provider={p.id} size={40} />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{info?.name ?? p.id}</p>
                      <p className="text-xs text-muted-foreground font-mono">mobile{p.suffix}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Enter Mobile */}
          {sellStep === "enter-mobile" && (
            <div className="space-y-4">
              {selectedSellProviderInfo && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <ProviderLogo provider={sellProvider!} size={36} />
                  <div>
                    <p className="font-semibold text-sm">{selectedSellProviderInfo.name}</p>
                    <p className="text-xs text-muted-foreground">Enter your registered mobile number</p>
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Mobile Number</label>
                <div className="relative mt-1">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-10 font-mono"
                    type="tel"
                    maxLength={10}
                    placeholder="Enter 10-digit mobile"
                    value={sellMobile}
                    onChange={e => setSellMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setSellStep("select-provider")} className="flex-1">Back</Button>
                <Button onClick={handleSellSendOtp} disabled={sellLoading || sellMobile.length < 10} className="flex-1">
                  {sellLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Send OTP
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Enter OTP */}
          {sellStep === "enter-otp" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">OTP sent to +91 {sellMobile}</p>
              <DevOtpBanner otp={sellDevOtp} />
              <div>
                <label className="text-sm font-medium">Enter OTP</label>
                <Input
                  className="mt-1 font-mono text-center text-xl tracking-[0.5em]"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={sellOtp}
                  onChange={e => setSellOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setSellStep("enter-mobile"); setSellOtp(""); setSellOtpSession(null); setSellDevOtp(null); setSellResendSecs(0); }} disabled={sellResendSecs > 0} className="flex-1">
                  {sellResendSecs > 0 ? `Resend in ${sellResendSecs}s` : "Back"}
                </Button>
                <Button onClick={handleSellVerifyOtp} disabled={sellLoading || sellOtp.length !== 6} className="flex-1">
                  {sellLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Verify
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {sellStep === "confirm" && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-emerald-800">Verified — UPI ID Ready</p>
                <p className="font-mono text-lg text-emerald-700 mt-1">{sellGeneratedUpiId}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Account Holder Name</label>
                <Input
                  className="mt-1"
                  placeholder="Your name"
                  value={sellHolderName}
                  onChange={e => setSellHolderName(e.target.value)}
                />
              </div>
              <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3 flex items-center gap-3">
                <ProviderLogo provider={sellProvider!} size={32} />
                <div>
                  <p>Provider: <strong>{selectedSellProviderInfo?.name}</strong></p>
                  <p>Mobile: <span className="font-mono">+91 {sellMobile}</span></p>
                </div>
              </div>
              <Button onClick={() => saveSellMut.mutate()} disabled={saveSellMut.isPending} className="w-full">
                {saveSellMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save UPI Account
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Buy UPI Wizard ── */}
      <Dialog open={showWizard} onOpenChange={(o) => { if (!o) { setShowWizard(false); resetWizard(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Buy UPI Account</DialogTitle>
          </DialogHeader>

          <StepBar labels={WIZARD_LABELS} current={buyStepIndex} />

          {/* Step 1: Select Provider */}
          {buyStep === "select-provider" && (
            <div className="space-y-2.5">
              <p className="text-sm text-muted-foreground">Select your UPI payment app</p>
              {BUY_PROVIDERS.map(p => {
                const info = PROVIDER_INFO[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => { setBuyProvider(p.id); setBuyStep("enter-mobile"); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary hover:bg-muted/50 transition-colors text-left"
                  >
                    <ProviderLogo provider={p.id} size={40} />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{info?.name ?? p.id}</p>
                      <p className="text-xs text-muted-foreground font-mono">mobile{p.suffix}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Enter Mobile */}
          {buyStep === "enter-mobile" && (
            <div className="space-y-4">
              {selectedBuyProviderInfo && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <ProviderLogo provider={buyProvider!} size={36} />
                  <div>
                    <p className="font-semibold text-sm">{selectedBuyProviderInfo.name}</p>
                    <p className="text-xs text-muted-foreground">Enter your registered mobile number</p>
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Mobile Number</label>
                <div className="relative mt-1">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-10 font-mono"
                    type="tel"
                    maxLength={10}
                    placeholder="Enter 10-digit mobile"
                    value={buyMobile}
                    onChange={e => setBuyMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setBuyStep("select-provider")} className="flex-1">Back</Button>
                <Button onClick={handleBuySendOtp} disabled={buyLoading || buyMobile.length < 10} className="flex-1">
                  {buyLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Send OTP
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Enter OTP */}
          {buyStep === "enter-otp" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">OTP sent to +91 {buyMobile}</p>
              <DevOtpBanner otp={buyDevOtp} />
              <div>
                <label className="text-sm font-medium">Enter OTP</label>
                <Input
                  className="mt-1 font-mono text-center text-xl tracking-[0.5em]"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={buyOtp}
                  onChange={e => setBuyOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setBuyStep("enter-mobile"); setBuyOtp(""); setBuyOtpSession(null); setBuyDevOtp(null); setBuyResendSecs(0); }} disabled={buyResendSecs > 0} className="flex-1">
                  {buyResendSecs > 0 ? `Resend in ${buyResendSecs}s` : "Back"}
                </Button>
                <Button onClick={handleBuyVerifyOtp} disabled={buyLoading || buyOtp.length !== 6} className="flex-1">
                  {buyLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Verify
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {buyStep === "confirm" && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-emerald-800">Verified — UPI ID Ready</p>
                <p className="font-mono text-lg text-emerald-700 mt-1">{buyGeneratedUpiId}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Account Holder Name</label>
                <Input
                  className="mt-1"
                  placeholder="Your name"
                  value={buyHolderName}
                  onChange={e => setBuyHolderName(e.target.value)}
                />
              </div>
              <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3 flex items-center gap-3">
                <ProviderLogo provider={buyProvider!} size={32} />
                <div>
                  <p>Provider: <strong>{selectedBuyProviderInfo?.name}</strong></p>
                  <p>Mobile: <span className="font-mono">+91 {buyMobile}</span></p>
                </div>
              </div>
              <Button onClick={handleSaveUpi} disabled={buyLoading} className="w-full">
                {buyLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save UPI Account
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* reCAPTCHA containers — must NOT be display:none */}
      <div id="buy-recaptcha-container" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
      <div id="sell-recaptcha-container" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
    </AppLayout>
  );
}
