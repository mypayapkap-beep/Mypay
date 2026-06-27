import AdminLayout from "@/components/AdminLayout";
import { adminApi, type BuyOrder } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, ShoppingCart, TrendingUp, Ban, AlertTriangle, History, Smartphone, Building2 } from "lucide-react";
import { useState } from "react";
import { getAccessToken } from "@/lib/auth";

const _apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function authFetch<T>(path: string): Promise<T> {
  const token = getAccessToken();
  return fetch(`${_apiBase}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
    return d as T;
  });
}

interface Cancellation {
  id: string;
  amount: string;
  cancelReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  userId: string;
  userName: string | null;
  userMobile: string | null;
  buyOrderTitle: string | null;
  todayCount: number;
  atLimit: boolean;
}

type PaymentMethod = "upi" | "bank";

const emptyForm = {
  title: "",
  amount: "",
  paymentMethod: "upi" as PaymentMethod,
  upiId: "",
  name: "",
  accountNumber: "",
  ifscCode: "",
  description: "",
  quantity: "1",
};

const BONUS = 0.05;
function calcIncome(amount: string) {
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 0) return "—";
  return (n * BONUS).toFixed(2);
}
function calcQuota(amount: string) {
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 0) return "—";
  return (n * (1 + BONUS)).toFixed(2);
}

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

function fmt(val?: string | null) {
  if (!val) return "0.00";
  return parseFloat(val).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function fmtDt(val?: string | null) {
  if (!val) return "—";
  return new Date(val).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminBuyOrdersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<BuyOrder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [cancelDate, setCancelDate] = useState(todayStr());

  const { data, isLoading } = useQuery({
    queryKey: ["admin-buy-orders"],
    queryFn: () => adminApi.getBuyOrders(),
  });

  const { data: cancelData, isLoading: cancelLoading } = useQuery({
    queryKey: ["admin-cancellations", cancelDate],
    queryFn: () => authFetch<{ cancellations: Cancellation[]; date: string; total: number }>(
      `/admin/deposits/cancellations?date=${cancelDate}&limit=100`
    ),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () => {
      const base = {
        title: form.title,
        amount: parseFloat(form.amount),
        paymentMethod: form.paymentMethod,
        name: form.name || undefined,
        description: form.description || undefined,
        isActive: true,
        quantity: parseInt(form.quantity) || 1,
      };
      if (form.paymentMethod === "upi") {
        return adminApi.createBuyOrder({ ...base, upiId: form.upiId });
      } else {
        return adminApi.createBuyOrder({ ...base, accountNumber: form.accountNumber, ifscCode: form.ifscCode });
      }
    },
    onSuccess: (data) => {
      toast({ title: `${data.count} order${data.count !== 1 ? "s" : ""} created` });
      qc.invalidateQueries({ queryKey: ["admin-buy-orders"] });
      setDialog(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof adminApi.updateBuyOrder>[1]) =>
      adminApi.updateBuyOrder(editing!.id, data),
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["admin-buy-orders"] });
      setDialog(null);
      setEditing(null);
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteBuyOrder(id),
    onSuccess: () => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["admin-buy-orders"] }); },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const orders: BuyOrder[] = data?.orders ?? [];

  const openEdit = (o: BuyOrder) => {
    setEditing(o);
    const method = (o.paymentMethod === "bank" ? "bank" : "upi") as PaymentMethod;
    setForm({
      title: o.title,
      amount: o.amount,
      paymentMethod: method,
      upiId: o.upiId ?? "",
      name: o.name ?? "",
      accountNumber: o.accountNumber ?? "",
      ifscCode: o.ifscCode ?? "",
      description: o.description ?? "",
      quantity: "1",
    });
    setDialog("edit");
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.amount) {
      toast({ title: "Title and Amount are required", variant: "destructive" });
      return;
    }
    const n = parseFloat(form.amount);
    if (isNaN(n) || n <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (form.paymentMethod === "upi") {
      if (!form.upiId.trim()) {
        toast({ title: "UPI ID is required", variant: "destructive" });
        return;
      }
    } else {
      if (!form.name.trim() || !form.accountNumber.trim() || !form.ifscCode.trim()) {
        toast({ title: "Account Holder Name, Account Number and IFSC Code are required", variant: "destructive" });
        return;
      }
    }

    if (dialog === "create") {
      createMut.mutate();
    } else {
      const base = {
        title: form.title,
        amount: n,
        paymentMethod: form.paymentMethod,
        name: form.name || undefined,
        description: form.description || undefined,
      };
      if (form.paymentMethod === "upi") {
        updateMut.mutate({ ...base, upiId: form.upiId, accountNumber: null, ifscCode: null });
      } else {
        updateMut.mutate({ ...base, upiId: null, accountNumber: form.accountNumber, ifscCode: form.ifscCode });
      }
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Buy Order Plans</h1>
            <p className="text-sm text-muted-foreground">Users earn 5% income on every approved plan</p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setDialog("create"); }}>
            <Plus className="w-4 h-4 mr-2" /> New Plan
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : orders.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No buy order plans yet. Create one to let users purchase tokens.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {orders.map((o) => {
                  const income = calcIncome(o.amount);
                  const quota = calcQuota(o.amount);
                  const isBank = o.paymentMethod === "bank";
                  return (
                    <div key={o.id} className="px-5 py-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold text-foreground">{o.title}</p>
                          <Badge variant={o.isActive ? "default" : "secondary"} className="text-xs">
                            {o.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="text-xs gap-1">
                            {isBank
                              ? <><Building2 className="w-3 h-3" />Bank</>
                              : <><Smartphone className="w-3 h-3" />UPI</>}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 flex-wrap text-sm">
                          <span className="font-mono font-bold text-foreground">
                            ₹{parseFloat(o.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-600">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Income ₹{income} (5%)
                          </span>
                          <span className="text-primary font-semibold">Quota +₹{quota}</span>
                        </div>

                        {isBank ? (
                          <div className="mt-1 space-y-0.5">
                            {o.name && <p className="text-xs text-muted-foreground">Holder: <span className="text-foreground">{o.name}</span></p>}
                            {o.accountNumber && <p className="text-xs text-muted-foreground">A/C: <span className="font-mono text-foreground">{o.accountNumber}</span></p>}
                            {o.ifscCode && <p className="text-xs text-muted-foreground">IFSC: <span className="font-mono text-foreground">{o.ifscCode}</span></p>}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">UPI: <span className="font-mono">{o.upiId}</span></p>
                        )}
                        {o.description && <p className="text-xs text-muted-foreground mt-0.5">{o.description}</p>}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          title={o.isActive ? "Deactivate" : "Activate"}
                          onClick={() => {
                            setEditing(o);
                            updateMut.mutate({ isActive: !o.isActive });
                          }}
                          disabled={updateMut.isPending}
                        >
                          {o.isActive
                            ? <ToggleRight className="w-4 h-4 text-emerald-600" />
                            : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("Delete this buy order plan?")) deleteMut.mutate(o.id); }}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Cancellation History ───────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                Buy Order Cancellation History
                {cancelData && (
                  <Badge variant="secondary" className="text-xs font-normal ml-1">
                    {cancelData.total} cancellation{cancelData.total !== 1 ? "s" : ""} on {cancelDate}
                  </Badge>
                )}
              </CardTitle>
              <input
                type="date"
                className="text-sm border border-input rounded-md px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={cancelDate}
                max={todayStr()}
                onChange={(e) => setCancelDate(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {cancelLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !cancelData?.cancellations?.length ? (
              <div className="py-10 text-center">
                <Ban className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No user-initiated cancellations on {cancelDate}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cancelData.cancellations.map((c) => (
                      <tr key={c.id} className={c.atLimit ? "bg-red-50/50" : "hover:bg-muted/20"}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{c.userName ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{c.userMobile}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-muted-foreground text-xs">{c.buyOrderTitle ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium">₹{fmt(c.amount)}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-muted-foreground max-w-[180px] truncate">{c.cancelReason ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-muted-foreground whitespace-nowrap">{fmtDt(c.cancelledAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            c.atLimit
                              ? "bg-red-100 text-red-700"
                              : c.todayCount >= 7
                              ? "bg-amber-100 text-amber-700"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {c.atLimit && <AlertTriangle className="w-3 h-3" />}
                            {c.todayCount}/10
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "New Buy Order Plan" : "Edit Buy Order Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* Payment Method Toggle */}
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, paymentMethod: "upi" }))}
                  className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    form.paymentMethod === "upi"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Smartphone className="w-4 h-4" /> UPI
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, paymentMethod: "bank" }))}
                  className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    form.paymentMethod === "bank"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Building2 className="w-4 h-4" /> Bank Account
                </button>
              </div>
            </div>

            {/* Plan Title */}
            <div>
              <label className="text-sm font-medium">Plan Title</label>
              <Input
                className="mt-1" placeholder="e.g. ₹500 Buy Plan"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-sm font-medium">Amount (₹)</label>
              <Input
                className="mt-1 font-mono" type="number" placeholder="500"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
              {form.amount && parseFloat(form.amount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Income: ₹{calcIncome(form.amount)} (5%) → User receives ₹{calcQuota(form.amount)} tokens
                </p>
              )}
            </div>

            {/* UPI fields */}
            {form.paymentMethod === "upi" && (
              <>
                <div>
                  <label className="text-sm font-medium">UPI ID <span className="text-destructive">*</span></label>
                  <Input
                    className="mt-1 font-mono" placeholder="merchant@paytm"
                    value={form.upiId} onChange={e => setForm(f => ({ ...f, upiId: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Account Holder Name <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    className="mt-1" placeholder="e.g. Rahul Sharma"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
              </>
            )}

            {/* Bank fields */}
            {form.paymentMethod === "bank" && (
              <>
                <div>
                  <label className="text-sm font-medium">Account Holder Name <span className="text-destructive">*</span></label>
                  <Input
                    className="mt-1" placeholder="e.g. Rahul Sharma"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Account Number <span className="text-destructive">*</span></label>
                  <Input
                    className="mt-1 font-mono" placeholder="e.g. 1234567890"
                    value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">IFSC Code <span className="text-destructive">*</span></label>
                  <Input
                    className="mt-1 font-mono uppercase" placeholder="e.g. SBIN0001234"
                    value={form.ifscCode} onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                  />
                </div>
              </>
            )}

            {/* Description */}
            <div>
              <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                className="mt-1" placeholder="Payment instructions..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Quantity (create only) */}
            {dialog === "create" && (
              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  className="mt-1 font-mono" type="number" placeholder="1" min="1" max="500"
                  value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {parseInt(form.quantity) > 1
                    ? `${form.quantity} separate orders will be created (each for one user)`
                    : "1 order (1 slot for 1 user)"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {dialog === "create" ? "Create Plan" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
