import { Link, useLocation } from "wouter";
import {
  Home, ShoppingBag, CreditCard, Users2, User,
  Wallet, Bell, HeadphonesIcon, LogOut, ArrowDownToLine
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetNotifications } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const bottomTabs = [
  { href: "/app/dashboard", label: "Home", icon: Home },
  { href: "/app/orders", label: "Recharge", icon: ShoppingBag },
  { href: "/app/upi", label: "Payment", icon: CreditCard },
  { href: "/app/referrals", label: "Team", icon: Users2 },
  { href: "/app/profile", label: "Account", icon: User },
];

const sidebarItems = [
  { href: "/app/dashboard", label: "Home", icon: Home },
  { href: "/app/orders", label: "Recharge", icon: ShoppingBag },
  { href: "/app/upi", label: "Payment UPI", icon: CreditCard },
  { href: "/app/wallet", label: "Wallet", icon: Wallet },
  { href: "/app/sell-requests", label: "Sell Requests", icon: ArrowDownToLine },
  { href: "/app/sell-upi", label: "Sell UPI", icon: ArrowDownToLine },
  { href: "/app/withdraw", label: "Withdraw", icon: ArrowDownToLine },
  { href: "/app/referrals", label: "Team", icon: Users2 },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/support", label: "Support", icon: HeadphonesIcon },
  { href: "/app/profile", label: "Account", icon: User },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuthContext();
  const { data: notifData } = useGetNotifications({ unread: true, limit: 1 });
  const unreadCount = notifData?.unreadCount ?? 0;

  const isActive = (href: string) =>
    location === href || (href === "/app/dashboard" && location === "/app");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 border-r border-border bg-card flex-col shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">M</span>
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">MyPay</p>
              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{user?.mobile ?? "..."}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {sidebarItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                isActive(href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {label === "Notifications" && unreadCount > 0 && (
                <Badge className="ml-auto h-4 min-w-4 text-[10px] px-1" variant="destructive">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive text-sm"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top header */}
        <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-foreground text-lg">MyPay</span>
          <Link href="/app/notifications" className="relative p-1">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-destructive rounded-full text-[8px] text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </header>

        {/* Page content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 p-4 md:p-6 overflow-auto pb-24 md:pb-6">{children}</main>
      </div>

      {/* Mobile bottom tab nav — fixed, 5 equal tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border flex" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {bottomTabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
              isActive(href) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
