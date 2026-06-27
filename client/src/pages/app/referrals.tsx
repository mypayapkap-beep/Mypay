import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Share2, Users, UserCheck, TrendingUp, Gift, IndianRupee, ArrowDownCircle, CheckCircle2 } from "lucide-react";
import { getAccessToken } from "@/lib/auth";

const _apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  return fetch(`${_apiBase}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
    return data as T;
  });
}

interface ReferralStats {
  referralCode?: string;
  totalReferrals: number;
  levelA: number;
  levelB: number;
  eligibleCount: number;
  eligibleReward: string;
  todayCommission: string;
  monthCommission: string;
  totalCommission: string;
  totalEarned: string;
}

function useReferralStats() {
  return useQuery<ReferralStats>({
    queryKey: ["referral-stats"],
    queryFn: () => authFetch("/referrals/stats"),
    staleTime: 30_000,
  });
}

interface MonthlyStats {
  monthReceived: string;
  monthProfit: string;
  monthTeamCommission: string;
}

function useMonthlyStats() {
  return useQuery<MonthlyStats>({
    queryKey: ["today-stats"],
    queryFn: () => {
      const token = getAccessToken();
      return fetch(`${_apiBase}/api/today-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
    },
    staleTime: 30_000,
  });
}

function fmt(val?: string | number | null) {
  if (val === undefined || val === null) return "0.00";
  return parseFloat(String(val)).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-2">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
        <p className={`text-xl font-bold ${accent ?? "text-foreground"}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function ReferralsPage() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stats, isLoading } = useReferralStats();
  const { data: monthly } = useMonthlyStats();

  const referralCode = stats?.referralCode ?? user?.referralCode ?? "";
  const referralLink = referralCode
    ? `${window.location.origin}/login?ref=${referralCode}`
    : "";

  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const copy = (text: string, type: "code" | "link") => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    setCopied(type);
    toast({ title: type === "code" ? "Referral code copied!" : "Referral link copied!" });
    setTimeout(() => setCopied(null), 2000);
  };

  const share = async () => {
    const shareData = {
      title: "Join MyPay — Earn ₹200 Bonus!",
      text: `🎁 Join MyPay using my referral code ${referralCode} and start earning!\n\nComplete tasks, earn rewards & transfer money instantly.\n`,
      url: referralLink,
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled — no-op
      }
    } else {
      copy(referralLink, "link");
    }
  };

  const claimMut = useMutation({
    mutationFn: () => authFetch<{ success: boolean; claimed: number; totalReward: string; message: string }>("/referrals/claim", { method: "POST" }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["referral-stats"] });
      qc.invalidateQueries({ queryKey: ["token-history"] });
      toast({ title: `✅ ${data.message}` });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Claim failed", variant: "destructive" }),
  });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team & Referrals</h1>
          <p className="text-sm text-muted-foreground">Earn ₹200 per direct referral after ₹5,000 buy volume</p>
        </div>

        {/* Share & Earn card */}
        <div className="rounded-2xl bg-[#0f1629] text-white overflow-hidden">
          {/* Header gradient strip */}
          <div className="px-5 pt-5 pb-4">
            <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">Your Referral Code</p>
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold tracking-[0.2em] font-mono">
                {referralCode || "———"}
              </p>
              <button
                type="button"
                onClick={() => copy(referralCode, "code")}
                className="ml-auto flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                {copied === "code" ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Copy Code</>
                )}
              </button>
            </div>
          </div>

          {/* Referral link row */}
          <div className="bg-white/5 border-t border-white/10 px-5 py-3">
            <p className="text-white/40 text-xs mb-1">Invite link</p>
            <p className="text-white/70 text-xs truncate font-mono mb-3">
              {referralLink || "—"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 bg-white/15 hover:bg-white/25 text-white border-0 h-9"
                onClick={() => copy(referralLink, "link")}
                disabled={!referralLink}
              >
                {copied === "link" ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Copied!</>
                ) : (
                  <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Link</>
                )}
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-white hover:bg-white/90 text-[#0f1629] font-semibold h-9"
                onClick={share}
                disabled={!referralLink}
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share & Earn
              </Button>
            </div>
          </div>

          {/* Reward badge */}
          <div className="bg-emerald-500/15 border-t border-emerald-500/20 px-5 py-2.5 flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-emerald-300 text-xs">
              Earn <span className="font-bold text-emerald-200">₹200</span> for every friend who completes ₹5,000 in buy orders
            </p>
          </div>
        </div>

        {/* Claim eligible rewards */}
        {!isLoading && (stats?.eligibleCount ?? 0) > 0 && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-emerald-900 text-sm">
                🎁 {stats!.eligibleCount} Direct Reward{stats!.eligibleCount > 1 ? "s" : ""} Ready!
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Claim ₹{fmt(stats!.eligibleReward)} now — ₹200 per eligible referral
              </p>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              size="sm"
              onClick={() => claimMut.mutate()}
              disabled={claimMut.isPending}
            >
              {claimMut.isPending ? "Claiming…" : "Claim Reward"}
            </Button>
          </div>
        )}

        {/* Team stats grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Users} label="Total Referrals" value={stats?.totalReferrals ?? 0} />
              <StatCard icon={UserCheck} label="Level A Members" value={stats?.levelA ?? 0} sub="Direct" />
              <StatCard icon={UserCheck} label="Level B Members" value={stats?.levelB ?? 0} sub="Indirect" />
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Team Commission
                </h2>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border text-center p-0">
                <div className="px-3 py-4">
                  <p className="text-xs text-muted-foreground mb-1">Today</p>
                  <p className="font-bold text-foreground">₹{fmt(stats?.todayCommission)}</p>
                </div>
                <div className="px-3 py-4">
                  <p className="text-xs text-muted-foreground mb-1">This Month</p>
                  <p className="font-bold text-foreground">₹{fmt(stats?.monthCommission)}</p>
                </div>
                <div className="px-3 py-4">
                  <p className="text-xs text-muted-foreground mb-1">Total</p>
                  <p className="font-bold text-emerald-600">₹{fmt(stats?.totalCommission)}</p>
                </div>
              </div>
            </div>

            {/* Monthly Activity */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                  Monthly Activity
                </h2>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border text-center">
                <div className="px-3 py-4">
                  <p className="text-xs text-muted-foreground mb-1">Month Received</p>
                  <p className="font-bold text-foreground">₹{fmt(monthly?.monthReceived)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Recharge</p>
                </div>
                <div className="px-3 py-4">
                  <p className="text-xs text-muted-foreground mb-1">Month Profit</p>
                  <p className="font-bold text-emerald-600">₹{fmt(monthly?.monthProfit)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">5% income</p>
                </div>
                <div className="px-3 py-4">
                  <p className="text-xs text-muted-foreground mb-1">Team Commission</p>
                  <p className="font-bold text-violet-600">₹{fmt(monthly?.monthTeamCommission)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This month</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Gift}
                label="Eligible Rewards"
                value={`${stats?.eligibleCount ?? 0} claim${(stats?.eligibleCount ?? 0) !== 1 ? "s" : ""}`}
                sub={`₹${fmt(stats?.eligibleReward)} ready`}
                accent="text-emerald-600"
              />
              <StatCard
                icon={IndianRupee}
                label="Total Earned"
                value={`₹${fmt(stats?.totalEarned)}`}
                sub="Claimed rewards"
              />
            </div>
          </>
        )}

        {/* How it works */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">How It Works</h2>
          <div className="space-y-2.5 text-sm">
            {[
              { step: "1", text: "Share your referral code with friends" },
              { step: "2", text: "They register using your code and complete buy orders" },
              { step: "3", text: "Once their total buy volume reaches ₹5,000, you get ₹200 direct reward — click Claim to receive it" },
              { step: "4", text: "You automatically earn 0.3% (Level A) on every approved buy from your direct referrals" },
              { step: "5", text: "You earn 0.1% (Level B) on every approved buy from referrals of your referrals" },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                  {step}
                </span>
                <p className="text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
