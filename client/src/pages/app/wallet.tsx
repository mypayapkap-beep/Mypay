import AppLayout from "@/components/AppLayout";
import { useGetWalletBalance } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

function formatAmount(val?: string | null) {
  if (!val) return "0.00";
  return parseFloat(val).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

interface HistoryItem {
  id: string;
  source: "ledger" | "deposit" | "transaction";
  displayType: string;
  label: string;
  amount: string;
  currency: "INR";
  isCredit: boolean;
  status: string;
  date: string;
  note: string | null;
}

const _apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function useTokenHistory() {
  return useQuery<{ items: HistoryItem[] }>({
    queryKey: ["token-history"],
    queryFn: () => {
      const token = getAccessToken();
      return fetch(`${_apiBase}/api/token-history`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
    },
    staleTime: 15_000,
  });
}

const statusBadgeMap: Record<string, { label: string; cls: string }> = {
  credited:           { label: "Credited",       cls: "bg-emerald-100 text-emerald-700" },
  debited:            { label: "Debited",         cls: "bg-red-100 text-red-700" },
  approved:           { label: "Approved",        cls: "bg-emerald-100 text-emerald-700" },
  paying:             { label: "Paying",          cls: "bg-blue-100 text-blue-700" },
  pending:            { label: "Pending",         cls: "bg-amber-100 text-amber-700" },
  pending_verification: { label: "Pending",       cls: "bg-amber-100 text-amber-700" },
  rejected:           { label: "Rejected",        cls: "bg-red-100 text-red-700" },
  cancelled:          { label: "Cancelled",       cls: "bg-gray-100 text-gray-600" },
  completed:          { label: "Paid",            cls: "bg-emerald-100 text-emerald-700" },
  paid:               { label: "Paid",            cls: "bg-emerald-100 text-emerald-700" },
};

const typeIconMap: Record<string, string> = {
  "Buy Approved":      "✅",
  "Buy Pending":       "⏳",
  "Buy - Paying":      "💳",
  "Buy Rejected":      "❌",
  "Buy Cancelled":     "🚫",
  "Sell Paid":         "💸",
  "Sell Pending":      "⏳",
  "Wallet Credit":     "⬆️",
  "Wallet Debit":      "⬇️",
  "Referral Reward":   "🎁",
  "Referral Bonus":    "🎁",
  "Team Commission":   "👥",
  "Task Reward":       "🏆",
  "Withdrawal Refund": "↩️",
};

export default function WalletPage() {
  const { data: balance, isLoading: balLoading } = useGetWalletBalance();
  const { data: historyData, isLoading: histLoading } = useTokenHistory();

  const items = historyData?.items ?? [];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-foreground">MyPay Token Wallet</h1>

        {/* Token Balance Card */}
        <div className="rounded-2xl bg-[#0f1629] text-white p-5">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
            <Wallet className="w-4 h-4" />
            Token Balance
          </div>
          {balLoading ? (
            <Skeleton className="h-9 w-36 bg-white/20" />
          ) : (
            <p className="text-3xl font-bold">₹{formatAmount(balance?.inrBalance)}</p>
          )}
          {balance?.isFrozen && (
            <span className="mt-2 inline-block text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">Frozen</span>
          )}
        </div>

        {/* Token History */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Token History</h2>
          </div>

          {histLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-muted-foreground text-sm">No token history yet</p>
              <p className="text-xs text-muted-foreground mt-1">Complete a buy order to see your history</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => {
                const badge = statusBadgeMap[item.status] ?? { label: item.status, cls: "bg-gray-100 text-gray-600" };
                const icon = typeIconMap[item.label] ?? "📋";
                return (
                  <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full", badge.cls)}>
                            {badge.label}
                          </span>
                        </div>
                        {item.note && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.note}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(item.date).toLocaleString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-sm font-bold",
                        item.isCredit ? "text-emerald-600" : "text-foreground",
                      )}>
                        {item.isCredit ? "+" : "-"}₹{formatAmount(item.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">INR</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
