import AdminLayout from "@/components/AdminLayout";
import { adminApi } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Users } from "lucide-react";
import { useState, useEffect } from "react";

const REFERRAL_KEYS = [
  {
    key: "referral_direct_reward",
    label: "Direct Referral Claim Reward (₹)",
    desc: "Amount credited when referrer clicks Claim after referred user meets buy volume threshold",
    prefix: "₹",
    suffix: "",
  },
  {
    key: "referral_volume_threshold",
    label: "Eligibility Buy Volume (₹)",
    desc: "Total approved buy volume the referred user must reach before the referrer can claim ₹200 reward",
    prefix: "₹",
    suffix: "",
  },
  {
    key: "referral_commission_level_a",
    label: "Level A Commission (%)",
    desc: "Auto-credited commission on every approved buy order from direct (Level A) referrals",
    prefix: "",
    suffix: "%",
  },
  {
    key: "referral_commission_level_b",
    label: "Level B Commission (%)",
    desc: "Auto-credited commission on every approved buy order from indirect (Level B) referrals",
    prefix: "",
    suffix: "%",
  },
];

export default function AdminReferralSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminApi.getSettings(),
  });

  useEffect(() => {
    if (!data?.settings) return;
    const map: Record<string, string> = {};
    for (const s of data.settings) {
      if (REFERRAL_KEYS.some(k => k.key === s.key)) map[s.key] = s.value;
    }
    setValues(map);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      for (const { key } of REFERRAL_KEYS) {
        if (values[key] !== undefined) {
          await adminApi.updateSetting(key, values[key]);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Referral settings saved" });
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Referral Settings</h1>
            <p className="text-sm text-muted-foreground">Configure referral rewards and team commission rates</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Team & Reward Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="space-y-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <>
                {REFERRAL_KEYS.map(({ key, label, desc, prefix, suffix }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-foreground">{label}</label>
                    <p className="text-xs text-muted-foreground mb-1.5">{desc}</p>
                    <div className="relative flex items-center">
                      {prefix && (
                        <span className="absolute left-3 text-muted-foreground text-sm">{prefix}</span>
                      )}
                      <Input
                        className={`font-mono ${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`}
                        type="number"
                        step={suffix === "%" ? "0.01" : "1"}
                        min="0"
                        value={values[key] ?? ""}
                        onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                      />
                      {suffix && (
                        <span className="absolute right-3 text-muted-foreground text-sm">{suffix}</span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">How these settings work:</p>
                  <p>• <strong>Direct Reward</strong>: Once a referred user's buy volume ≥ Eligibility Volume, referrer can click Claim to receive this amount.</p>
                  <p>• <strong>Level A Commission</strong>: Auto-credited to direct referrer on every approved buy order.</p>
                  <p>• <strong>Level B Commission</strong>: Auto-credited to indirect referrer (referrer's referrer) on every approved buy order.</p>
                </div>

                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full">
                  {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Save className="w-4 h-4 mr-2" /> Save Referral Settings
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
