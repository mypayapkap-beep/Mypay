import AdminLayout from "@/components/AdminLayout";
import { useAdminGetSettings, useAdminUpdateSetting, getAdminGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Edit2, Check, X, CreditCard, ArrowDownToLine, Smartphone } from "lucide-react";
import { useState } from "react";
import { ProviderLogo, PROVIDER_INFO } from "@/components/ProviderLogo";

const PAYMENT_APPS = [
  { id: "phonepe" },
  { id: "paytm" },
  { id: "mobikwik" },
  { id: "airtel" },
  { id: "freecharge" },
] as const;

export default function AdminUpiSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminGetSettings();
  const updateSetting = useAdminUpdateSetting();
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);

  const getSetting = (key: string) =>
    data?.settings?.find(s => s.key === key);

  const handleSave = () => {
    if (!editing) return;
    updateSetting.mutate(
      { key: editing.key, data: { value: editing.value } },
      {
        onSuccess: () => {
          toast({ title: "UPI setting updated" });
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  };

  const handleSelectApp = (appId: string) => {
    const appName = PROVIDER_INFO[appId]?.name ?? appId;
    updateSetting.mutate(
      { key: "active_payment_app", data: { value: appId } },
      {
        onSuccess: () => {
          toast({ title: `Active payment app set to ${appName}` });
          queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  };

  const buyUpi = getSetting("admin_buy_upi_id");
  const sellUpi = getSetting("admin_sell_upi_id");
  const activeApp = getSetting("active_payment_app")?.value ?? "phonepe";

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">UPI Settings</h1>
          <p className="text-sm text-muted-foreground">Manage Buy UPI, Sell UPI, and active payment app</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : (
          <>
            {/* Buy UPI ID */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Buy UPI ID
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Users send payment to this UPI ID when placing buy orders.
                </p>
                {editing?.key === "admin_buy_upi_id" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editing.value}
                      onChange={e => setEditing({ key: "admin_buy_upi_id", value: e.target.value })}
                      placeholder="e.g. mypay@upi"
                      className="font-mono"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="text-emerald-600 h-9 w-9" onClick={handleSave} disabled={updateSetting.isPending}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditing(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-muted rounded-lg px-3 py-2 font-mono text-sm min-h-9 flex items-center">
                      {buyUpi?.value ? (
                        <span className="text-foreground font-semibold">{buyUpi.value}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Not set</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ key: "admin_buy_upi_id", value: buyUpi?.value ?? "" })}
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                      {buyUpi?.value ? "Edit" : "Set"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sell UPI ID */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                  Sell UPI ID
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Admin uses this UPI ID to pay users when approving sell requests.
                </p>
                {editing?.key === "admin_sell_upi_id" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editing.value}
                      onChange={e => setEditing({ key: "admin_sell_upi_id", value: e.target.value })}
                      placeholder="e.g. admin@paytm"
                      className="font-mono"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="text-emerald-600 h-9 w-9" onClick={handleSave} disabled={updateSetting.isPending}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditing(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-muted rounded-lg px-3 py-2 font-mono text-sm min-h-9 flex items-center">
                      {sellUpi?.value ? (
                        <span className="text-foreground font-semibold">{sellUpi.value}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Not set</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ key: "admin_sell_upi_id", value: sellUpi?.value ?? "" })}
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                      {sellUpi?.value ? "Edit" : "Set"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Payment App */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-violet-600" />
                  Active Payment App
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Choose which payment app is shown to users on the buy order page.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PAYMENT_APPS.map(app => {
                    const info = PROVIDER_INFO[app.id];
                    const isActive = activeApp === app.id;
                    return (
                      <button
                        key={app.id}
                        onClick={() => !isActive && handleSelectApp(app.id)}
                        disabled={updateSetting.isPending}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          isActive
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <ProviderLogo provider={app.id} size={36} />
                        <div>
                          <p className="font-semibold text-sm text-foreground">{info.name}</p>
                          {isActive && (
                            <p className="text-xs text-primary font-medium">Active</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
