import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";
import { AdminAuthProvider, useAdminAuthContext } from "@/context/AdminAuthContext";
import "@/lib/api";

import LoginPage from "@/pages/login";
import InstallPage from "@/pages/install";
import DashboardPage from "@/pages/app/dashboard";
import WalletPage from "@/pages/app/wallet";
import OrdersPage from "@/pages/app/orders";
import UpiPage from "@/pages/app/upi";
import ReferralsPage from "@/pages/app/referrals";
import NotificationsPage from "@/pages/app/notifications";
import SupportPage from "@/pages/app/support";
import ProfilePage from "@/pages/app/profile";
import TermsPage from "@/pages/app/terms";

import AdminLoginPage from "@/pages/admin/login";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminUsersPage from "@/pages/admin/users";
import AdminDepositsPage from "@/pages/admin/deposits";
import AdminWithdrawalsPage from "@/pages/admin/withdrawals";
import AdminTasksPage from "@/pages/admin/tasks";
import AdminUpiPage from "@/pages/admin/upi";
import AdminSettingsPage from "@/pages/admin/settings";
import AdminBannersPage from "@/pages/admin/banners";
import AdminAnnouncementsPage from "@/pages/admin/announcements";
import AdminLogsPage from "@/pages/admin/logs";
import AdminSupportPage from "@/pages/admin/support";
import AdminBuyOrdersPage from "@/pages/admin/buy-orders";
import AdminBuyRequestApprovalPage from "@/pages/admin/buy-request-approval";
import AdminWalletAdjustmentPage from "@/pages/admin/wallet-adjustment";
import AdminReferralSettingsPage from "@/pages/admin/referral-settings";
import AdminTelegramSettingsPage from "@/pages/admin/telegram-settings";
import AdminUpiSettingsPage from "@/pages/admin/upi-settings";
import AdminSellRequestsPage from "@/pages/admin/sell-requests";
import WithdrawPage from "@/pages/app/withdraw";
import SellRequestsPage from "@/pages/app/sell-requests";
import SellUpiPage from "@/pages/app/sell-upi";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedUserRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuthContext();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function ProtectedAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAdminAuthContext();
  if (!isAuthenticated) return <Redirect to="/admin/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/install" component={InstallPage} />

      <Route path="/app">
        <ProtectedUserRoute component={DashboardPage} />
      </Route>
      <Route path="/app/dashboard">
        <ProtectedUserRoute component={DashboardPage} />
      </Route>
      <Route path="/app/wallet">
        <ProtectedUserRoute component={WalletPage} />
      </Route>
      <Route path="/app/orders">
        <ProtectedUserRoute component={OrdersPage} />
      </Route>
      <Route path="/app/upi">
        <ProtectedUserRoute component={UpiPage} />
      </Route>
      <Route path="/app/referrals">
        <ProtectedUserRoute component={ReferralsPage} />
      </Route>
      <Route path="/app/notifications">
        <ProtectedUserRoute component={NotificationsPage} />
      </Route>
      <Route path="/app/support">
        <ProtectedUserRoute component={SupportPage} />
      </Route>
      <Route path="/app/profile">
        <ProtectedUserRoute component={ProfilePage} />
      </Route>
      <Route path="/app/terms">
        <ProtectedUserRoute component={TermsPage} />
      </Route>

      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin">
        <ProtectedAdminRoute component={AdminDashboardPage} />
      </Route>
      <Route path="/admin/dashboard">
        <ProtectedAdminRoute component={AdminDashboardPage} />
      </Route>
      <Route path="/admin/users">
        <ProtectedAdminRoute component={AdminUsersPage} />
      </Route>
      <Route path="/admin/deposits">
        <ProtectedAdminRoute component={AdminDepositsPage} />
      </Route>
      <Route path="/admin/withdrawals">
        <ProtectedAdminRoute component={AdminWithdrawalsPage} />
      </Route>
      <Route path="/admin/tasks">
        <ProtectedAdminRoute component={AdminTasksPage} />
      </Route>
      <Route path="/admin/upi">
        <ProtectedAdminRoute component={AdminUpiPage} />
      </Route>
      <Route path="/admin/settings">
        <ProtectedAdminRoute component={AdminSettingsPage} />
      </Route>
      <Route path="/admin/banners">
        <ProtectedAdminRoute component={AdminBannersPage} />
      </Route>
      <Route path="/admin/announcements">
        <ProtectedAdminRoute component={AdminAnnouncementsPage} />
      </Route>
      <Route path="/admin/logs">
        <ProtectedAdminRoute component={AdminLogsPage} />
      </Route>
      <Route path="/admin/support">
        <ProtectedAdminRoute component={AdminSupportPage} />
      </Route>
      <Route path="/admin/buy-orders">
        <ProtectedAdminRoute component={AdminBuyOrdersPage} />
      </Route>
      <Route path="/admin/buy-request-approval">
        <ProtectedAdminRoute component={AdminBuyRequestApprovalPage} />
      </Route>
      <Route path="/admin/wallet-adjustment">
        <ProtectedAdminRoute component={AdminWalletAdjustmentPage} />
      </Route>
      <Route path="/admin/referral-settings">
        <ProtectedAdminRoute component={AdminReferralSettingsPage} />
      </Route>
      <Route path="/admin/telegram-settings">
        <ProtectedAdminRoute component={AdminTelegramSettingsPage} />
      </Route>
      <Route path="/admin/upi-settings">
        <ProtectedAdminRoute component={AdminUpiSettingsPage} />
      </Route>
      <Route path="/admin/sell-requests">
        <ProtectedAdminRoute component={AdminSellRequestsPage} />
      </Route>

      <Route path="/app/withdraw">
        <ProtectedUserRoute component={WithdrawPage} />
      </Route>
      <Route path="/app/sell-requests">
        <ProtectedUserRoute component={SellRequestsPage} />
      </Route>
      <Route path="/app/sell-upi">
        <ProtectedUserRoute component={SellUpiPage} />
      </Route>

      <Route path="/">
        <Redirect to={`/login${window.location.search}`} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AdminAuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AdminAuthProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
