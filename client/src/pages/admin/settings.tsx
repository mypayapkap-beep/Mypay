import AdminLayout from "@/components/AdminLayout";
import { useAdminGetSettings, useAdminUpdateSetting, getAdminGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Edit2, Check, X } from "lucide-react";
import { useState } from "react";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminGetSettings();
  const updateSetting = useAdminUpdateSetting();
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);

  const handleSave = () => {
    if (!editing) return;
    updateSetting.mutate(
      { key: editing.key, data: { value: editing.value } },
      {
        onSuccess: () => {
          toast({ title: "Setting updated" });
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure application settings</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">App Configuration</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : data?.settings?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No settings configured</div>
            ) : (
              <div className="divide-y divide-border">
                {data?.settings?.map(s => (
                  <div key={s.id} className="px-4 py-4 flex items-center gap-3" data-testid={`setting-row-${s.key}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-mono font-semibold text-foreground">{s.key}</p>
                        {s.isPublic && <Badge variant="secondary" className="text-xs">Public</Badge>}
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                      {editing?.key === s.key ? (
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            value={editing?.value ?? ""}
                            onChange={e => editing && setEditing({ key: editing.key, value: e.target.value })}
                            className="h-8 text-sm"
                            data-testid={`input-setting-${s.key}`}
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={handleSave}
                            data-testid={`button-save-setting-${s.key}`}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground mt-1 font-mono bg-muted px-2 py-0.5 rounded inline-block">
                          {s.value}
                        </p>
                      )}
                    </div>
                    {editing?.key !== s.key && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                        onClick={() => setEditing({ key: s.key!, value: s.value! })}
                        data-testid={`button-edit-setting-${s.key}`}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
