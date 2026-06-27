import AppLayout from "@/components/AppLayout";
import { useGetProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useAuthContext } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingBag, CreditCard, Coins, ClipboardList,
  Info, MessageCircle, LogOut, ChevronRight, User,
} from "lucide-react";

const _apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function usePublicSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch(`${_apiBase}/api/public/settings`).then(r => r.json()) as Promise<{ settings: Record<string, string> }>,
    staleTime: 60_000,
  });
}

export default function ProfilePage() {
  const { user, logout } = useAuthContext();
  const { toast } = useToast();
  const { data, isLoading } = useGetProfile();
  const { data: settingsData } = usePublicSettings();

  const profile = data?.profile as any;
  const settings = settingsData?.settings ?? {};
  const telegramSupport = settings["telegram_support_username"];

  const uid = profile?.id ? profile.id.replace(/-/g, "").substring(0, 8).toUpperCase() : "—";

  type MenuItem =
    | { icon: React.ElementType; label: string; href: string; external?: boolean; action?: never }
    | { icon: React.ElementType; label: string; action: () => void; href?: never; external?: never };

  const menuItems: MenuItem[] = [
    { icon: ShoppingBag, label: "Order", href: "/app/orders" },
    { icon: CreditCard, label: "Recharge", href: "/app/orders" },
    { icon: Coins, label: "Token", href: "/app/wallet" },
    { icon: ClipboardList, label: "Task", href: "/app/orders" },
    { icon: Info, label: "About", href: "/app/terms" },
    {
      icon: MessageCircle,
      label: "Contact",
      href: telegramSupport ? `https://t.me/${telegramSupport}` : "#",
      external: true,
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-4">

        {/* User Card */}
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  {profile?.profileImageUrl ? (
                    <img src={profile.profileImageUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-foreground text-base">{profile?.name ?? user?.name ?? "..."}</p>
                  <p className="text-sm text-muted-foreground">{profile?.mobile ?? user?.mobile}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">UID</span>
                <span className="text-sm font-mono font-semibold text-foreground">{uid}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reward ratio</span>
                <span className="text-sm font-bold text-orange-500">2%</span>
              </div>
              {profile?.referralCode && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Referral Code</span>
                  <button
                    className="text-sm font-mono font-semibold text-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(profile.referralCode ?? "");
                      toast({ title: "Referral code copied!" });
                    }}
                  >
                    {profile.referralCode}
                  </button>
                </div>
              )}

              {/* UPI link */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-sm text-muted-foreground">UPI Accounts</span>
                <Link href="/app/upi" className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                  Manage
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

            </div>
          </div>
        )}

        {/* Menu List */}
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {menuItems.map(({ icon: Icon, label, href, external, action }) => {
            if (action) {
              return (
                <button
                  key={label}
                  onClick={action}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            }
            if (external && href) {
              return (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </a>
              );
            }
            return (
              <Link key={label} href={href ?? "#"}>
                <div className="flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}

          <button
            onClick={logout}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <LogOut className="w-5 h-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">Sign out</span>
            </div>
            <ChevronRight className="w-4 h-4 text-destructive" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
