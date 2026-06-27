import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";
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
import WithdrawPage from "@/pages/app/withdraw";
import SellRequestsPage from "@/pages/app/sell-requests";
import DepositPage from "@/pages/app/deposit";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedUserRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuthContext();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
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
      <Route path="/app/deposit">
        <ProtectedUserRoute component={DepositPage} />
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
      <Route path="/app/withdraw">
        <ProtectedUserRoute component={WithdrawPage} />
      </Route>
      <Route path="/app/sell-requests">
        <ProtectedUserRoute component={SellRequestsPage} />
      </Route>

      <Route path="/">
        <Redirect to="/login" />
      </Route>

      {/* Block any attempt to navigate to admin — redirect to login */}
      <Route path="/admin">
        <Redirect to="/login" />
      </Route>
      <Route path="/admin/:rest*">
        <Redirect to="/login" />
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
          <WouterRouter base="/">
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
