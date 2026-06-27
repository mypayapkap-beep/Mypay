import AdminLayout from "@/components/AdminLayout";
import { adminApi } from "@/lib/admin-api";
import { useAdminListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Wallet, PlusCircle, MinusCircle } from "lucide-react";
import { useState } from "react";

type AdjustModal = { userId: string; userName: string } | null;

export default function AdminWalletAdjustmentPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<AdjustModal>(null);
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const { data, isLoading } = useAdminListUsers({ search, limit: 30 });

  const adjustMut = useMutation({
    mutationFn: () =>
      adminApi.adjustWallet(modal!.userId, { type, amount: parseFloat(amount), reason }),
    onSuccess: (data) => {
      toast({ title: data.message ?? "Wallet adjusted" });
      setModal(null);
      setAmount("");
      setReason("");
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const users = data?.users ?? [];

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet Adjustment</h1>
          <p className="text-sm text-muted-foreground">Manually credit or debit user wallets</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {search ? "No users matching search" : "No users found"}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users.map((u: any) => (
                  <div key={u.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{u.mobile}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => { setModal({ userId: u.id, userName: u.name }); setType("credit"); }}
                      >
                        <PlusCircle className="w-3.5 h-3.5 mr-1" /> Credit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-red-200 hover:bg-red-50"
                        onClick={() => { setModal({ userId: u.id, userName: u.name }); setType("debit"); }}
                      >
                        <MinusCircle className="w-3.5 h-3.5 mr-1" /> Debit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {type === "credit" ? "Credit" : "Debit"} Wallet — {modal?.userName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(v: "credit" | "debit") => setType(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit (Add money)</SelectItem>
                  <SelectItem value="debit">Debit (Remove money)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Amount (₹)</label>
              <Input
                className="mt-1 font-mono" type="number" placeholder="0.00"
                value={amount} onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Input
                className="mt-1" placeholder="Reason for adjustment..."
                value={reason} onChange={e => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button
              onClick={() => adjustMut.mutate()}
              disabled={!amount || !reason.trim() || adjustMut.isPending}
              className={type === "debit" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {adjustMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm {type === "credit" ? "Credit" : "Debit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
