import AppLayout from "@/components/AppLayout";
import { useGetUserSellRequests } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatAmount(val?: string | null) {
  if (!val) return "0.00";
  return parseFloat(val).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-700",    icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700",         icon: <XCircle className="w-3 h-3" /> },
};

export default function SellRequestsPage() {
  const { data, isLoading } = useGetUserSellRequests({ limit: 50 });
  const items = (data as any)?.sellRequests ?? [];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sell Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sell requests are created by admin. Once approved, tokens are deducted and payment is sent to your UPI.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">My Sell Requests</h2>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="py-14 text-center space-y-1">
              <TrendingDown className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm font-medium">No sell requests yet</p>
              <p className="text-xs text-muted-foreground">
                Contact support or admin to initiate a sell request
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item: any) => {
                const cfg = statusConfig[item.status] ?? statusConfig.pending;
                return (
                  <div key={item.id} className="px-4 py-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-xl shrink-0 mt-0.5">
                        {item.status === "approved" ? "💸" : item.status === "rejected" ? "❌" : "⏳"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">Sell Request</p>
                          <Badge className={cn("text-xs font-medium gap-1 px-1.5 py-0.5", cfg.cls)}>
                            {cfg.icon}
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            Tokens: <span className="text-foreground font-medium">₹{formatAmount(item.tokenAmount)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            You receive: <span className="text-foreground font-medium">₹{formatAmount(item.sellAmount)}</span>
                          </p>
                        </div>
                        {item.adminNotes && item.status === "rejected" && (
                          <p className="text-xs text-destructive mt-1">Reason: {item.adminNotes}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.status === "approved" && item.approvedAt
                            ? `Approved: ${formatDate(item.approvedAt)}`
                            : item.status === "rejected" && item.rejectedAt
                            ? `Rejected: ${formatDate(item.rejectedAt)}`
                            : `Requested: ${formatDate(item.createdAt)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        -₹{formatAmount(item.tokenAmount)}
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
