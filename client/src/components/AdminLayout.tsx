import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, ShoppingCart, FileCheck, Wallet,
  ArrowDownToLine, Users2, Send, Settings, ScrollText,
  HeadphonesIcon, LogOut, Menu, X, Shield, CreditCard
} from "lucide-react";
import { useState } from "react";
import { useAdminAuthContext } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/buy-orders", label: "Buy Orders", icon: ShoppingCart },
  { href: "/admin/buy-request-approval", label: "Buy Request Approval", icon: FileCheck },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/wallet-adjustment", label: "Wallet Adjustment", icon: Wallet },
  { href: "/admin/sell-requests", label: "Sell Requests", icon: ArrowDownToLine },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { href: "/admin/upi-settings", label: "UPI Settings", icon: CreditCard },
  { href: "/admin/referral-settings", label: "Referral Settings", icon: Users2 },
  { href: "/admin/telegram-settings", label: "Telegram Settings", icon: Send },
  { href: "/admin/support", label: "Support", icon: HeadphonesIcon },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/logs", label: "Audit Logs", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { admin, logout } = useAdminAuthContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">MyPay Admin</p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">{admin?.name ?? "..."}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href === "/admin/dashboard" && location === "/admin");
          return (
            <Link
              key={href}
              href={href}
              data-testid={`admin-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground mb-2 px-3">
          {admin?.role && <span className="capitalize">{admin.role.replace("_", " ")}</span>}
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={logout}
          data-testid="button-admin-logout"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-60 border-r border-border bg-card flex-col shrink-0">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-foreground">Admin Panel</span>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto pb-6">{children}</main>
      </div>
    </div>
  );
}
