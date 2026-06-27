import AppLayout from "@/components/AppLayout";
import { getAccessToken } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag, CheckCircle, Clock, XCircle, AlertCircle,
  TrendingUp, Loader2, Copy, Camera, Ban, AlertTriangle,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface BuyOrder {
  id: string;
  title: string;
  amount: string;
  paymentMethod: string;
  upiId?: string | null;
  name?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  description?: string | null;
  maxClaims: number;
  remainingSlots: number;
  createdAt: string;
}

interface ActiveDeposit {
  id: string;
  amount: string;
  status: string;
  screenshotUrl: string | null;
  utrNumber: string | null;
  timerStartedAt: string | null;
  createdAt: string;
  buyOrder: {
    id: string;
    title: string;
    paymentMethod: string;
    upiId?: string | null;
    name?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    amount: string;
  };
}

interface UserDeposit {
  id: string;
  amount: string;
  utrNumber: string | null;
  buyOrderId?: string | null;
  buyOrderTitle?: string | null;
  buyOrderPaymentMethod?: string | null;
  buyOrderUpiId?: string | null;
  buyOrderName?: string | null;
  buyOrderAccountNumber?: string | null;
  buyOrderIfscCode?: string | null;
  buyOrderAmount?: string | null;
  status: string;
  adminNotes?: string | null;
  cancelReason?: string | null;
  screenshotUrl?: string | null;
  timerStartedAt?: string | null;
  createdAt: string;
}

interface UpiAccount {
  id: string;
  status: string;
  deletedAt: string | null;
}

const BASE = "";

function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) return Promise.reject(new Error("Not authenticated"));
  return fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data as T;
  });
}

const TIMER_MS = 30 * 60 * 1000; // 30 minutes

function useCountdown(timerStartedAt: string | null | undefined) {
  const getRemaining = () => {
    if (!timerStartedAt) return TIMER_MS;
    const elapsed = Date.now() - new Date(timerStartedAt).getTime();
    return Math.max(0, TIMER_MS - elapsed);
  };

  const [remaining, setRemaining] = useState<number>(getRemaining);

  useEffect(() => {
    if (!timerStartedAt) return;
    setRemaining(getRemaining());
    const interval = setInterval(() => {
      const rem = getRemaining();
      setRemaining(rem);
      if (rem === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStartedAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const isExpired = remaining === 0 && !!timerStartedAt;

  return { remaining, minutes, seconds, isExpired };
}

const BONUS = 0.05;
function calcIncome(amount: string) { return (parseFloat(amount) * BONUS).toFixed(2); }
function calcQuota(amount: string) { return (parseFloat(amount) * (1 + BONUS)).toFixed(2); }
function fmt(val: string | number) {
  return parseFloat(String(val)).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function isExpiredDeposit(d: UserDeposit) {
  return d.status === "cancelled" && d.cancelReason === "Timer expired";
}

const statusMeta: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  paying: { icon: <Clock className="w-3.5 h-3.5" />, label: "Paying", cls: "bg-blue-100 text-blue-800" },
  pending: { icon: <Clock className="w-3.5 h-3.5" />, label: "Pending Review", cls: "bg-amber-100 text-amber-800" },
  pending_verification: { icon: <Clock className="w-3.5 h-3.5" />, label: "Pending Review", cls: "bg-amber-100 text-amber-800" },
  approved: { icon: <CheckCircle className="w-3.5 h-3.5" />, label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { icon: <XCircle className="w-3.5 h-3.5" />, label: "Rejected", cls: "bg-red-100 text-red-800" },
  cancelled: { icon: <Ban className="w-3.5 h-3.5" />, label: "Cancelled", cls: "bg-gray-100 text-gray-600" },
  expired: { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: "Expired", cls: "bg-orange-100 text-orange-700" },
};

export default function OrdersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"task-list" | "my-task">("task-list");
  const [activeDeposit, setActiveDeposit] = useState<ActiveDeposit | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [utrInput, setUtrInput] = useState("");
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [upiRequiredDialog, setUpiRequiredDialog] = useState(false);

  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ["buy-orders-available"],
    queryFn: () => authFetch<{ orders: BuyOrder[] }>("/orders"),
    staleTime: 10_000,
  });

  const { data: depositsData, isLoading: depositsLoading } = useQuery({
    queryKey: ["user-deposits-list"],
    queryFn: () => authFetch<{ deposits: UserDeposit[] }>("/deposits?limit=30"),
    staleTime: 10_000,
  });

  const { data: upiData } = useQuery({
    queryKey: ["upi-accounts-check"],
    queryFn: () => authFetch<{ accounts: UpiAccount[] }>("/upi"),
    staleTime: 30_000,
  });

  const hasApprovedUpi = (upiData?.accounts ?? []).some(
    (a) => a.status === "approved" && !a.deletedAt
  );

  const buyMut = useMutation({
    mutationFn: (order: BuyOrder) =>
      authFetch<{ success: boolean; isExisting: boolean; deposit: ActiveDeposit }>("/deposits", {
        method: "POST",
        body: JSON.stringify({ buyOrderId: order.id, amount: parseFloat(order.amount) }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["user-deposits-list"] });
      qc.invalidateQueries({ queryKey: ["buy-orders-available"] });
      setActiveDeposit(data.deposit);
      setScreenshot(null);
      setUtrInput("");
      toast({ title: data.isExisting ? "Resuming your existing order" : "Order created — complete your payment" });
    },
    onError: (e: any) => {
      if (e?.message === "upi_required") {
        setUpiRequiredDialog(true);
      } else {
        toast({ title: e?.message ?? "Failed to create order", variant: "destructive" });
      }
    },
  });

  const confirmMut = useMutation({
    mutationFn: ({ id, screenshotUrl, utrNumber }: { id: string; screenshotUrl: string; utrNumber?: string }) =>
      authFetch<{ success: boolean }>(`/deposits/${id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ screenshotUrl, utrNumber: utrNumber || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-deposits-list"] });
      setActiveDeposit(null);
      setScreenshot(null);
      setUtrInput("");
      toast({ title: "✅ Order submitted — waiting for admin review" });
    },
    onError: (e: any) => {
      if (e?.message === "timer_expired") {
        qc.invalidateQueries({ queryKey: ["user-deposits-list"] });
        setActiveDeposit(null);
        setScreenshot(null);
        setUtrInput("");
        toast({ title: "⏰ Order timer expired — please start a new order", variant: "destructive" });
      } else {
        toast({ title: e?.message ?? "Failed to confirm order", variant: "destructive" });
      }
    },
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      authFetch<{ success: boolean }>(`/deposits/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-deposits-list"] });
      qc.invalidateQueries({ queryKey: ["buy-orders-available"] });
      setActiveDeposit(null);
      setScreenshot(null);
      setUtrInput("");
      setCancelDialog(false);
      setCancelReason("");
      toast({ title: "Order cancelled" });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed to cancel order", variant: "destructive" }),
  });

  // Timer for the active payment dialog
  const { minutes: timerMin, seconds: timerSec, isExpired: timerExpired } = useCountdown(
    activeDeposit?.status === "paying" ? activeDeposit?.timerStartedAt : null
  );

  // Auto-cancel when timer hits zero
  useEffect(() => {
    if (timerExpired && activeDeposit && activeDeposit.status === "paying" && !cancelMut.isPending) {
      cancelMut.mutate({ id: activeDeposit.id, reason: "Timer expired" });
    }
  }, [timerExpired]);

  function openOrder(order: BuyOrder) {
    if (!hasApprovedUpi) {
      setUpiRequiredDialog(true);
      return;
    }
    buyMut.mutate(order);
  }

  function openExistingDeposit(d: UserDeposit) {
    if (!d.buyOrderTitle) return;
    setActiveDeposit({
      id: d.id,
      amount: d.amount,
      status: d.status,
      screenshotUrl: d.screenshotUrl ?? null,
      utrNumber: d.utrNumber,
      timerStartedAt: d.timerStartedAt ?? null,
      createdAt: d.createdAt,
      buyOrder: {
        id: d.buyOrderId ?? "",
        title: d.buyOrderTitle,
        paymentMethod: d.buyOrderPaymentMethod ?? "upi",
        upiId: d.buyOrderUpiId ?? null,
        name: d.buyOrderName ?? null,
        accountNumber: d.buyOrderAccountNumber ?? null,
        ifscCode: d.buyOrderIfscCode ?? null,
        amount: d.buyOrderAmount ?? d.amount,
      },
    });
    setScreenshot(null);
    setUtrInput(d.utrNumber ?? "");
  }

  function closePaymentDetail() {
    setActiveDeposit(null);
    setScreenshot(null);
    setUtrInput("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image under 8MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setScreenshot(reader.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied` });
    }).catch(() => {
      toast({ title: "Copy failed — please copy manually", variant: "destructive" });
    });
  }

  function handleConfirm() {
    if (!activeDeposit || !screenshot || confirmMut.isPending) return;
    if (timerExpired) {
      toast({ title: "⏰ Timer expired — please start a new order", variant: "destructive" });
      return;
    }
    confirmMut.mutate({ id: activeDeposit.id, screenshotUrl: screenshot, utrNumber: utrInput || undefined });
  }

  function handleCancel() {
    if (!activeDeposit || !cancelReason.trim() || cancelMut.isPending) return;
    cancelMut.mutate({ id: activeDeposit.id, reason: cancelReason.trim() });
  }

  const orders = (ordersData?.orders ?? []).sort(
    (a, b) => parseFloat(b.amount) - parseFloat(a.amount)
  );
  const allDeposits = depositsData?.deposits ?? [];
  const myOrders = allDeposits.filter((d) => d.buyOrderId);

  const isPaymentDetailOpen = !!activeDeposit && !cancelDialog;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-0 rounded-xl border border-border overflow-hidden">
          <button
            className={cn(
              "flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors",
              activeTab === "task-list"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setActiveTab("task-list")}
          >
            <ShoppingBag className="w-4 h-4" />
            Task List
          </button>
          <button
            className={cn(
              "flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors",
              activeTab === "my-task"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setActiveTab("my-task")}
          >
            <ClipboardListIcon className="w-4 h-4" />
            My Task
          </button>
        </div>

        {/* Sort notice */}
        {activeTab === "task-list" && orders.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">From high to low ↓</p>
        )}

        {/* Banner */}
        {activeTab === "task-list" && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-2 text-xs text-red-600 font-medium text-center">
            Complete a task to earn Commission and Bonus
          </div>
        )}

        {/* TASK LIST TAB */}
        {activeTab === "task-list" && (
          <>
            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
              </div>
            ) : ordersError ? (
              <Card>
                <CardContent className="flex flex-col items-center py-12 text-center gap-2">
                  <AlertCircle className="w-8 h-8 text-destructive/60" />
                  <p className="text-sm text-muted-foreground">Failed to load orders. Please refresh.</p>
                </CardContent>
              </Card>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="font-medium text-foreground">No active tasks</p>
                  <p className="text-sm text-muted-foreground mt-1">Admin will publish buy order plans here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const income = calcIncome(order.amount);
                  const quota = calcQuota(order.amount);
                  return (
                    <Card key={order.id} className="border hover:border-primary/40 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground text-base mb-2">
                              {fmt(order.amount)} INR
                            </p>
                            <div className="flex gap-4 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Income</p>
                                <p className="font-semibold text-foreground">{fmt(income)} (5%)</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Quota</p>
                                <p className="font-semibold text-foreground">+{fmt(quota)}</p>
                              </div>
                            </div>
                            {order.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{order.description}</p>
                            )}
                            {order.maxClaims > 1 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {order.remainingSlots} slot{order.remainingSlots !== 1 ? "s" : ""} remaining
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="shrink-0 rounded-full px-5"
                            onClick={() => openOrder(order)}
                            disabled={buyMut.isPending}
                          >
                            {buyMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Buy"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* MY TASK TAB */}
        {activeTab === "my-task" && (
          <>
            {depositsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : myOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="font-medium text-foreground">No tasks yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Buy an order from the Task List to get started</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {myOrders.map((d) => {
                  const expired = isExpiredDeposit(d);
                  const metaKey = expired ? "expired" : (d.status in statusMeta ? d.status : "pending");
                  const meta = statusMeta[metaKey]!;
                  const quota = calcQuota(d.amount);
                  const isOpen = d.status === "paying" || d.status === "pending_verification";

                  // Timer for "paying" cards in My Task list
                  const cardTimerMs = d.status === "paying" && d.timerStartedAt
                    ? Math.max(0, TIMER_MS - (Date.now() - new Date(d.timerStartedAt).getTime()))
                    : null;
                  const cardMin = cardTimerMs !== null ? Math.floor(cardTimerMs / 60000) : null;
                  const cardSec = cardTimerMs !== null ? Math.floor((cardTimerMs % 60000) / 1000) : null;

                  return (
                    <Card
                      key={d.id}
                      className={cn("border transition-colors", isOpen && "cursor-pointer hover:border-primary/40")}
                      onClick={() => isOpen ? openExistingDeposit(d) : undefined}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>
                                {meta.icon} {meta.label}
                              </span>
                              <span className="font-bold text-foreground">₹{fmt(d.amount)}</span>
                            </div>
                            {d.buyOrderTitle && (
                              <p className="text-xs text-muted-foreground">{d.buyOrderTitle}</p>
                            )}
                            {d.status === "approved" && (
                              <p className="text-xs text-emerald-600 font-medium flex items-center gap-0.5 mt-1">
                                <TrendingUp className="w-3 h-3" /> +₹{fmt(quota)} credited
                              </p>
                            )}
                            {d.status === "paying" && cardMin !== null && (
                              <p className="text-xs text-blue-600 font-medium mt-1">
                                ⏰ {String(cardMin).padStart(2, "0")}:{String(cardSec!).padStart(2, "0")} remaining — tap to pay
                              </p>
                            )}
                            {d.status === "pending_verification" && (
                              <p className="text-xs text-amber-600 mt-1">Waiting for admin review</p>
                            )}
                            {expired && (
                              <p className="text-xs text-orange-600 mt-1">Timer expired — please start a new order</p>
                            )}
                            {d.adminNotes && d.status === "rejected" && (
                              <p className="text-xs text-red-600 mt-1">Note: {d.adminNotes}</p>
                            )}
                            {d.cancelReason && !expired && (
                              <p className="text-xs text-muted-foreground mt-1">Cancelled: {d.cancelReason}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(d.createdAt).toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Detail Dialog */}
      <Dialog open={isPaymentDetailOpen} onOpenChange={(open) => !open && closePaymentDetail()}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Payment Detail</DialogTitle>
          </DialogHeader>

          {activeDeposit && (
            <div className="space-y-4">
              {/* Status + Timer */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                  <Clock className="w-3 h-3" />
                  {activeDeposit.status === "paying" ? "Paying" : "Pending Review"}
                </span>
                <span className="text-xs text-muted-foreground truncate">{activeDeposit.buyOrder.title}</span>
              </div>

              {/* Countdown Timer */}
              {activeDeposit.status === "paying" && activeDeposit.timerStartedAt && (
                <div className={cn(
                  "rounded-lg border px-3 py-2 text-center",
                  timerExpired
                    ? "border-red-200 bg-red-50"
                    : timerMin === 0 && timerSec < 60
                      ? "border-orange-200 bg-orange-50"
                      : "border-blue-200 bg-blue-50"
                )}>
                  {timerExpired ? (
                    <p className="text-sm font-bold text-red-600 flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Order Expired
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-0.5">Time remaining to pay</p>
                      <p className={cn(
                        "text-2xl font-mono font-bold tabular-nums",
                        timerMin === 0 ? "text-orange-600" : "text-blue-700"
                      )}>
                        {String(timerMin).padStart(2, "0")}:{String(timerSec).padStart(2, "0")}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Amount */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount to Pay</p>
                    <p className="text-2xl font-bold text-foreground">₹{fmt(activeDeposit.amount)}</p>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => copyToClipboard(parseFloat(activeDeposit.amount).toFixed(2), "Amount")}
                    disabled={timerExpired}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                  </Button>
                </div>

                <div className="h-px bg-border" />

                {activeDeposit.buyOrder.paymentMethod === "bank" ? (
                  <div className="space-y-3">
                    {activeDeposit.buyOrder.name && (
                      <div>
                        <p className="text-xs text-muted-foreground">Account Holder</p>
                        <p className="text-sm font-semibold text-foreground">{activeDeposit.buyOrder.name}</p>
                      </div>
                    )}
                    {activeDeposit.buyOrder.accountNumber && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Account Number</p>
                          <p className="text-sm font-mono font-semibold text-foreground break-all">{activeDeposit.buyOrder.accountNumber}</p>
                        </div>
                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => copyToClipboard(activeDeposit.buyOrder.accountNumber!, "Account Number")} disabled={timerExpired}>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                        </Button>
                      </div>
                    )}
                    {activeDeposit.buyOrder.ifscCode && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">IFSC Code</p>
                          <p className="text-sm font-mono font-semibold text-foreground">{activeDeposit.buyOrder.ifscCode}</p>
                        </div>
                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => copyToClipboard(activeDeposit.buyOrder.ifscCode!, "IFSC Code")} disabled={timerExpired}>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Pay to UPI ID</p>
                      <p className="text-sm font-mono font-semibold text-foreground break-all">{activeDeposit.buyOrder.upiId}</p>
                      {activeDeposit.buyOrder.name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{activeDeposit.buyOrder.name}</p>
                      )}
                    </div>
                    <Button
                      size="sm" variant="outline" className="shrink-0 ml-3"
                      onClick={() => copyToClipboard(activeDeposit.buyOrder.upiId!, "UPI ID")}
                      disabled={timerExpired}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                  </div>
                )}
              </div>

              {/* Instructions */}
              {!timerExpired && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {activeDeposit.buyOrder.paymentMethod === "bank"
                    ? <>Transfer exactly <strong>₹{fmt(activeDeposit.amount)}</strong> to the bank account above.</>
                    : <>Send exactly <strong>₹{fmt(activeDeposit.amount)}</strong> to the UPI ID above.</>
                  }
                  {" "}Then upload your payment screenshot and click <strong>Confirm Order</strong>.
                </div>
              )}

              {/* Screenshot upload (only for paying status and timer not expired) */}
              {activeDeposit.status === "paying" && !timerExpired && (
                <>
                  <div>
                    <p className="text-sm font-medium mb-2">Upload Payment Screenshot</p>
                    <div
                      className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {screenshot ? (
                        <img src={screenshot} className="max-h-36 mx-auto rounded-lg object-contain" alt="Payment proof" />
                      ) : (
                        <div className="py-3">
                          <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Tap to upload payment proof</p>
                          <p className="text-xs text-muted-foreground mt-1">JPG, PNG (max 8MB)</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </div>

                  <div>
                    <label className="text-sm font-medium">UTR / Transaction ID <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <Input
                      className="mt-1.5"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 423100012345"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <Button
                      className="w-full"
                      onClick={handleConfirm}
                      disabled={!screenshot || confirmMut.isPending}
                    >
                      {confirmMut.isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</>
                        : "Confirm Order"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full text-destructive border-red-200 hover:bg-red-50"
                      onClick={() => setCancelDialog(true)}
                      disabled={confirmMut.isPending}
                    >
                      Cancel Order
                    </Button>
                  </div>
                </>
              )}

              {/* Timer expired state */}
              {activeDeposit.status === "paying" && timerExpired && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-center text-muted-foreground">
                    The 30-minute payment window has closed. Please return to the Task List to start a new order.
                  </p>
                  <Button className="w-full" onClick={closePaymentDetail}>
                    Back to Task List
                  </Button>
                </div>
              )}

              {/* Pending verification — screenshot already submitted */}
              {activeDeposit.status === "pending_verification" && (
                <>
                  {activeDeposit.screenshotUrl && (
                    <div>
                      <p className="text-sm font-medium mb-2">Your submitted screenshot</p>
                      <img src={activeDeposit.screenshotUrl} className="max-h-36 w-full rounded-xl object-contain border" alt="Submitted payment proof" />
                    </div>
                  )}
                  <p className="text-xs text-center text-muted-foreground">
                    Your order is under admin review. You will be notified once approved.
                  </p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog} onOpenChange={(open) => { if (!open) { setCancelDialog(false); setCancelReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Please provide a reason for cancellation:</p>
            <Input
              placeholder="Reason for cancellation"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancel}
                disabled={!cancelReason.trim() || cancelMut.isPending}
              >
                {cancelMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirm Cancel
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setCancelDialog(false); setCancelReason(""); }}>
                Go Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* UPI Required Dialog */}
      <Dialog open={upiRequiredDialog} onOpenChange={setUpiRequiredDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              UPI Account Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need a verified UPI account before you can buy an order. Please add your UPI account and wait for admin approval.
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => {
                  setUpiRequiredDialog(false);
                  setLocation("/app/upi");
                }}
              >
                Add UPI Account
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setUpiRequiredDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function ClipboardListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </svg>
  );
}
