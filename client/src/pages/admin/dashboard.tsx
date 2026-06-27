import AdminLayout from "@/components/AdminLayout";
import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowDownToLine, ArrowUpFromLine, ListChecks, HeadphonesIcon, ShieldAlert, Coins } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

function fmt(n: string | number | undefined, decimals = 2): string {
  const val = parseFloat(String(n ?? "0"));
  if (isNaN(val)) return "0";
  return val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCount(n: number | undefined): string {
  return (n ?? 0).toLocaleString("en-IN");
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useGetAdminDashboard();
  const overview = data?.overview;

  const primaryStats = [
    {
      label: "Total Tokens",
      value: isLoading ? null : `₹${fmt(overview?.totalTokens)}`,
      icon: Coins,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      description: "Sum of all user wallet balances",
    },
    {
      label: "Total Users",
      value: isLoading ? null : fmtCount(overview?.totalUsers),
      icon: Users,
      href: "/admin/users",
      color: "text-blue-500",
      bg: "bg-blue-50",
      description: "Registered accounts",
    },
    {
      label: "Total Deposits",
      value: isLoading ? null : fmtCount(overview?.totalDepositsCount),
      subValue: isLoading ? null : `₹${fmt(overview?.totalDepositsAmount)}`,
      icon: ArrowDownToLine,
      href: "/admin/deposits",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      description: "Approved deposits",
    },
    {
      label: "Total Withdrawals",
      value: isLoading ? null : fmtCount(overview?.totalWithdrawalsCount),
      subValue: isLoading ? null : `₹${fmt(overview?.totalWithdrawalsAmount)}`,
      icon: ArrowUpFromLine,
      href: "/admin/withdrawals",
      color: "text-purple-500",
      bg: "bg-purple-50",
      description: "Approved withdrawals",
    },
  ];

  const pendingStats = [
    { label: "Pending Deposits", value: overview?.pendingDeposits, icon: ArrowDownToLine, href: "/admin/deposits", color: "text-amber-500", bg: "bg-amber-50", urgent: (overview?.pendingDeposits ?? 0) > 0 },
    { label: "Pending Withdrawals", value: overview?.pendingWithdrawals, icon: ArrowUpFromLine, href: "/admin/withdrawals", color: "text-purple-500", bg: "bg-purple-50", urgent: (overview?.pendingWithdrawals ?? 0) > 0 },
    { label: "Pending Submissions", value: overview?.pendingTaskSubmissions, icon: ListChecks, href: "/admin/tasks", color: "text-emerald-500", bg: "bg-emerald-50", urgent: (overview?.pendingTaskSubmissions ?? 0) > 0 },
    { label: "Open Tickets", value: overview?.openSupportTickets, icon: HeadphonesIcon, href: "/admin/support", color: "text-rose-500", bg: "bg-rose-50", urgent: (overview?.openSupportTickets ?? 0) > 0 },
    { label: "Fraud Alerts (24h)", value: overview?.flaggedFraudLast24h, icon: ShieldAlert, href: "/admin/logs", color: "text-red-600", bg: "bg-red-50", urgent: (overview?.flaggedFraudLast24h ?? 0) > 0 },
  ];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform overview</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Key Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {primaryStats.map(({ label, value, subValue, icon: Icon, href, color, bg, description }) => {
              const inner = (
                <Card className={cn("h-full", href && "cursor-pointer hover:shadow-md transition-shadow")}>
                  <CardContent className="p-5">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", bg)}>
                      <Icon className={cn("w-5 h-5", color)} />
                    </div>
                    {isLoading ? (
                      <>
                        <Skeleton className="h-8 w-24 mb-1" />
                        <Skeleton className="h-4 w-16 mt-1" />
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-foreground leading-none">{value ?? "0"}</p>
                        {subValue && (
                          <p className="text-sm text-muted-foreground mt-1">{subValue}</p>
                        )}
                      </>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 leading-tight">{description}</p>
                  </CardContent>
                </Card>
              );
              return href ? (
                <Link key={label} href={href} className="block">
                  {inner}
                </Link>
              ) : (
                <div key={label}>{inner}</div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Action Required</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {pendingStats.map(({ label, value, icon: Icon, href, color, bg, urgent }) => (
              <Link
                key={label}
                href={href}
                data-testid={`admin-stat-${label.toLowerCase().replace(/\s/g, "-")}`}
                className="block"
              >
                <Card className={cn("cursor-pointer hover:shadow-md transition-shadow", urgent && "ring-1 ring-destructive/30")}>
                  <CardContent className="p-4">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", bg)}>
                      <Icon className={cn("w-5 h-5", color)} />
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20 mb-1" />
                    ) : (
                      <p className={cn("text-2xl font-bold", urgent ? "text-destructive" : "text-foreground")}>
                        {value ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {overview?.newUsersLast30d != null && (
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">New users (last 30 days)</p>
              <p className="text-3xl font-bold text-foreground mt-1" data-testid="stat-new-users">{overview.newUsersLast30d}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
