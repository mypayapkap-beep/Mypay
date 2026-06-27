import AppLayout from "@/components/AppLayout";
import { useGetWalletBalance, useGetPublicAnnouncements } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Link } from "wouter";
import { Wallet, FileText, Pin, Users, ChevronRight, Send } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth";
import { useState, useEffect, useCallback } from "react";

function fmt(val?: string | null) {
  if (!val) return "0.00";
  return parseFloat(val).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

const _apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function usePublicBanners() {
  return useQuery({
    queryKey: ["public-banners"],
    queryFn: () =>
      fetch(`${_apiBase}/api/public/banners`).then(r => r.json()) as Promise<{
        banners: { id: string; title: string; imageUrl: string; linkUrl?: string | null }[];
      }>,
    staleTime: 60_000,
  });
}

function usePublicSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    queryFn: () =>
      fetch(`${_apiBase}/api/public/settings`).then(r => r.json()) as Promise<{
        settings: Record<string, string>;
      }>,
    staleTime: 120_000,
  });
}

function useTodayStats() {
  return useQuery({
    queryKey: ["today-stats"],
    queryFn: () => {
      const token = getAccessToken();
      return fetch(`${_apiBase}/api/today-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()) as Promise<{
        todayReceived: string;
        todayProfit: string;
        monthReceived: string;
        monthProfit: string;
        monthTeamCommission: string;
      }>;
    },
    staleTime: 30_000,
  });
}

function BannerSlider({ banners }: { banners: { id: string; title: string; imageUrl: string; linkUrl?: string | null }[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback((api: CarouselApi) => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;
    onSelect(api);
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  useEffect(() => {
    if (!api || banners.length <= 1) return;
    const id = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, 3500);
    return () => clearInterval(id);
  }, [api, banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className="relative w-full">
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: "start" }}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {banners.map(banner => (
            <CarouselItem key={banner.id} className="pl-0">
              {banner.linkUrl ? (
                <a
                  href={banner.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl overflow-hidden"
                >
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-auto object-cover"
                    draggable={false}
                  />
                </a>
              ) : (
                <div className="block rounded-2xl overflow-hidden">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-auto object-cover"
                    draggable={false}
                  />
                </div>
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => api?.scrollTo(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === current
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 w-1.5"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthContext();
  const { data: balance, isLoading: balLoading } = useGetWalletBalance();
  const { data: announcements } = useGetPublicAnnouncements();
  const { data: bannersData } = usePublicBanners();
  const { data: settingsData } = usePublicSettings();
  const { data: todayStats, isLoading: statsLoading } = useTodayStats();
  const [commissionOpen, setCommissionOpen] = useState(false);

  const banners = bannersData?.banners ?? [];
  const settings = settingsData?.settings ?? {};
  const incomePct = settings["income_percentage"] ?? "5";
  const telegramLink = settings["telegram_channel_link"] ?? "";
  const pinnedAnnouncements = announcements?.announcements?.filter(a => a.isPinned) ?? [];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Welcome */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Hello, {user?.name ?? "there"}</h1>
          <p className="text-muted-foreground text-sm">Here's your financial overview</p>
        </div>

        {/* Pinned announcements */}
        {pinnedAnnouncements.map(a => (
          <div key={a.id} className="flex items-start gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl text-sm">
            <Pin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">{a.title}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{a.content}</p>
            </div>
          </div>
        ))}

        {/* Token Balance */}
        <div className="rounded-2xl bg-[#0f1629] text-white p-5">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
            <Wallet className="w-4 h-4" />
            MyPay Token Balance
          </div>
          {balLoading ? (
            <Skeleton className="h-9 w-36 bg-white/20" />
          ) : (
            <p className="text-3xl font-bold">₹{fmt(balance?.inrBalance)}</p>
          )}
        </div>

        {/* Today Stats — 2 column */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 divide-x divide-border text-center">
            <div className="px-3">
              <p className="text-xs text-muted-foreground mb-1">Today Received</p>
              {statsLoading ? (
                <Skeleton className="h-7 w-20 mx-auto" />
              ) : (
                <p className="font-bold text-foreground text-xl">₹{fmt(todayStats?.todayReceived)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">Recharge today</p>
            </div>
            <div className="px-3">
              <p className="text-xs text-muted-foreground mb-1">Today Profit</p>
              {statsLoading ? (
                <Skeleton className="h-7 w-20 mx-auto" />
              ) : (
                <p className="font-bold text-emerald-600 text-xl">₹{fmt(todayStats?.todayProfit)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{incomePct}% income</p>
            </div>
          </div>
        </div>

        {/* Team Commission Banner */}
        <button
          onClick={() => setCommissionOpen(true)}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 hover:from-violet-100 hover:to-indigo-100 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Team Commission</p>
              <p className="text-xs text-muted-foreground">Earn up to 0.3% on your team's activity</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {/* Telegram Channel Link — always visible */}
        <a
          href={telegramLink || "#"}
          target={telegramLink ? "_blank" : "_self"}
          rel="noreferrer"
          className="flex items-center justify-between p-4 rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/30 hover:bg-[#229ED9]/20 transition-colors"
          onClick={!telegramLink ? (e) => e.preventDefault() : undefined}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#229ED9]/20 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-[#229ED9]" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Join Our Telegram</p>
              <p className="text-xs text-muted-foreground">Get updates, offers & support</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </a>

        {/* Promotional Banner Slider/Carousel */}
        <BannerSlider banners={banners} />

        {/* Terms & Rules Banner */}
        <Link href="/app/terms">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted border border-border hover:bg-muted/70 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Terms & Rules</p>
                <p className="text-xs text-muted-foreground">Read our platform rules and guidelines</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      </div>

      {/* Team Commission Rules Popup */}
      <Dialog open={commissionOpen} onOpenChange={setCommissionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Team Commission Rules</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">A</span>
                <div>
                  <p className="font-semibold text-foreground">Level A — Direct Referrals</p>
                  <p className="text-muted-foreground text-xs mt-1">Earn <strong className="text-violet-700">0.3%</strong> commission on every approved buy order from your direct referrals, credited automatically.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">B</span>
                <div>
                  <p className="font-semibold text-foreground">Level B — Indirect Referrals</p>
                  <p className="text-muted-foreground text-xs mt-1">Earn <strong className="text-indigo-700">0.1%</strong> commission on every approved buy order from your indirect referrals, credited automatically.</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <p className="font-semibold text-emerald-800 text-xs">🎁 Direct Referral Bonus</p>
              <p className="text-emerald-700 text-xs mt-1">
                Earn a fixed <strong>₹200</strong> bonus once a direct referral completes <strong>₹5,000</strong> in total buy volume. Go to Team page to claim.
              </p>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Commission is credited automatically when your team's buy orders are approved.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
