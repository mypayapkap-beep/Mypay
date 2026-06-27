import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListSellRequests,
  useAdminCreateSellRequest,
  useAdminApproveSellRequest,
  useAdminRejectSellRequest,
} from "@workspace/api-client-react";
import { adminApi } from "@/lib/admin-api";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function formatAmount(val?: string | null) {
  if (!val) return "0.00";
  return parseFloat(val).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-700",   icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700",        icon: <XCircle className="w-3 h-3" /> },
};

// User lookup hook — uses admin token via adminApi.getUsers()
function useAdminSearchUser(mobile: string) {
  return useQuery({
    queryKey: ["admin-user-search", mobile],
    queryFn: () =>
      adminApi.getUsers({ search: mobile, limit: "1" }) as Promise<{
        users: Array<{ id: string; name: string; mobile: string; inrBalance?: string; sellUpiId?: string | null }>;
      }>,
    enabled: mobile.length >= 5,
    staleTime: 10_000,
  });
}

export default function AdminSellRequestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create form state
  const [mobile, setMobile] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("pending");

  // Reject dialog
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // User search
  const { data: searchData, isFetching: searching } = useAdminSearchUser(mobile);
  const foundUser = searchData?.users?.[0] ?? null;

  // List
  const { data, isLoading } = useAdminListSellRequests({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 50,
  });

  const items = (data as any)?.sellRequests ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["adminListSellRequests"] });
    queryClient.invalidateQueries({ queryKey: ["getUserSellRequests"] });
    queryClient.invalidateQueries({ queryKey: ["getWalletBalance"] });
    queryClient.invalidateQueries({ queryKey: ["adminGetDashboard"] });
  };

  // Mutations
  const createMut = useAdminCreateSellRequest({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sell request created" });
        setMobile("");
        setTokenAmount("");
        setAdminNotes("");
        invalidate();
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
    },
  });

  const approveMut = useAdminApproveSellRequest({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sell request approved & tokens deducted" });
        invalidate();
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed to approve", variant: "destructive" }),
    },
  });

  const rejectMut = useAdminRejectSellRequest({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sell request rejected" });
        setRejectId(null);
        setRejectReason("");
        invalidate();
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed to reject", variant: "destructive" }),
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim()) { toast({ title: "Enter mobile number", variant: "destructive" }); return; }
    const amt = parseFloat(tokenAmount);
    if (!tokenAmount || isNaN(amt) || amt <= 0) { toast({ title: "Enter valid token amount", variant: "destructive" }); return; }
    createMut.mutate({ data: { mobile: mobile.trim(), tokenAmount: amt, adminNotes: adminNotes.trim() || undefined } });
  };

  const handleApprove = (id: string) => {
    approveMut.mutate({ id, data: {} });
  };

  const handleReject = () => {
    if (!rejectId || !rejectReason.trim()) { toast({ title: "Enter rejection reason", variant: "destructive" }); return; }
    rejectMut.mutate({ id: rejectId, data: { reason: rejectReason.trim() } });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sell Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage token sell requests for users</p>
        </div>

        {/* ── Create Sell Request ─────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Sell Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mobile search */}
                <div className="space-y-1.5">
                  <Label>User Mobile Number</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="e.g. +919876543210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {foundUser && (
                    <p className="text-xs text-emerald-600 font-medium">
                      ✓ {foundUser.name} — {foundUser.mobile}
                    </p>
                  )}
                  {mobile.length >= 5 && !searching && !foundUser && (
                    <p className="text-xs text-destructive">No user found</p>
                  )}
                </div>

                {/* Token amount */}
                <div className="space-y-1.5">
                  <Label>Token Amount (₹)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={tokenAmount}
                    onChange={(e) => setTokenAmount(e.target.value)}
                  />
                  {tokenAmount && parseFloat(tokenAmount) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      User receives ₹{parseFloat(tokenAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} via UPI
                    </p>
                  )}
                </div>
              </div>

              {/* Admin notes */}
              <div className="space-y-1.5">
                <Label>Admin Notes (optional)</Label>
                <Input
                  placeholder="Internal notes…"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={createMut.isPending || !mobile.trim() || !tokenAmount}
                className="w-full md:w-auto"
              >
                {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Sell Request
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── Sell Request List ───────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">All Sell Requests</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground text-sm">No sell requests found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item: any) => {
                  const cfg = statusConfig[item.status] ?? statusConfig.pending;
                  return (
                    <div key={item.id} className="px-4 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-foreground">₹{formatAmount(item.sellAmount)}</span>
                          <Badge className={cn("text-xs font-medium gap-1 px-2 py-0.5", cfg.cls)}>
                            {cfg.icon}
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground font-medium">{item.userName ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{item.userMobile}</p>
                        {item.userSellUpi ? (
                          <p className="text-xs font-mono text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 inline-block">
                            {item.userSellUpi}
                            {item.userSellUpiProvider ? ` · ${item.userSellUpiProvider}` : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600">⚠ No sell UPI set</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {item.status === "approved" && item.approvedAt
                            ? `Approved: ${formatDate(item.approvedAt)}`
                            : item.status === "rejected" && item.rejectedAt
                            ? `Rejected: ${formatDate(item.rejectedAt)}`
                            : `Created: ${formatDate(item.createdAt)}`}
                        </p>
                        {item.adminNotes && (
                          <p className="text-xs text-muted-foreground italic">Note: {item.adminNotes}</p>
                        )}
                      </div>

                      {item.status === "pending" && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 text-xs"
                            onClick={() => handleApprove(item.id)}
                            disabled={approveMut.isPending}
                          >
                            {approveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-400 text-red-500 hover:bg-red-50 hover:text-red-600 text-xs"
                            onClick={() => { setRejectId(item.id); setRejectReason(""); }}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Sell Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              The sell request will be rejected. No tokens will be deducted from the user's wallet.
            </p>
            <div className="space-y-1.5">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Explain why this request is being rejected…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMut.isPending || !rejectReason.trim()}
            >
              {rejectMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
