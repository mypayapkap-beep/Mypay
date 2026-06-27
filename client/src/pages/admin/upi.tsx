import AdminLayout from "@/components/AdminLayout";
import { useAdminListUpiAccounts, useAdminApproveUpi, useAdminRejectUpi, getAdminListUpiAccountsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, CreditCard, Search, Copy } from "lucide-react";
import { useState, useMemo } from "react";
import { ProviderLogo, getProviderName } from "@/components/ProviderLogo";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

function CopyBtn({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline ml-1"
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copied!" }); }}
      title="Copy"
    >
      <Copy className="w-3 h-3" />
    </button>
  );
}

export default function AdminUpiPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useAdminListUpiAccounts({ status, limit: 100 });
  const approve = useAdminApproveUpi();
  const reject = useAdminRejectUpi();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListUpiAccountsQueryKey({ status, limit: 100 }) });

  const handleApprove = (id: string) => {
    approve.mutate({ id, data: {} }, {
      onSuccess: () => { toast({ title: "UPI account approved" }); invalidate(); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
    });
  };

  const handleReject = () => {
    if (!rejectModal) return;
    reject.mutate({ id: rejectModal.id, data: { reason } }, {
      onSuccess: () => { toast({ title: "UPI account rejected" }); setRejectModal(null); setReason(""); invalidate(); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.accounts ?? [];
    return (data?.accounts ?? []).filter(acc =>
      acc.userName?.toLowerCase().includes(q) ||
      acc.userMobile?.includes(q) ||
      acc.upiId?.toLowerCase().includes(q),
    );
  }, [data?.accounts, search]);

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">UPI Accounts</h1>
          <p className="text-sm text-muted-foreground">Review and approve user-linked UPI accounts</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, mobile or UPI ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground text-sm">{search ? "No results match your search" : `No ${status} UPI accounts`}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(acc => (
                  <div key={acc.id} className="px-4 py-4 flex items-start gap-3">
                    <ProviderLogo provider={acc.provider ?? ""} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm">{acc.upiId}</span>
                        <CopyBtn text={acc.upiId ?? ""} />
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize ${statusColor[acc.status ?? "pending"]}`}>
                          {acc.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getProviderName(acc.provider ?? "")} · {acc.accountHolderName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground">{acc.userName}</span>
                        {" · "}
                        <span className="font-mono">{acc.userMobile}</span>
                        <CopyBtn text={acc.userMobile ?? ""} />
                      </p>
                      {(acc as any).rejectedReason && (
                        <p className="text-xs text-destructive mt-1">Reason: {(acc as any).rejectedReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {acc.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => handleApprove(acc.id!)}
                            disabled={approve.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-red-200 hover:bg-red-50"
                            onClick={() => setRejectModal({ id: acc.id! })}
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!rejectModal} onOpenChange={o => { if (!o) { setRejectModal(null); setReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject UPI Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Provide a reason for rejection (optional)</p>
            <Input
              placeholder="e.g. Invalid UPI ID format"
              value={reason}
              onChange={e => setReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectModal(null); setReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reject.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
