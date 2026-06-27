import AdminLayout from "@/components/AdminLayout";
import { useAdminListDeposits, useAdminApproveDeposit, useAdminRejectDeposit, getAdminListDepositsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { useState } from "react";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function AdminDepositsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useAdminListDeposits({ status, limit: 30 });
  const approve = useAdminApproveDeposit();
  const reject = useAdminRejectDeposit();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey({ status, limit: 30 }) });

  const handleApprove = (id: string) => {
    approve.mutate(
      { id, data: {} },
      {
        onSuccess: () => { toast({ title: "Deposit approved" }); invalidate(); },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  };

  const handleReject = () => {
    if (!rejectModal) return;
    reject.mutate(
      { id: rejectModal.id, data: { reason } },
      {
        onSuccess: () => { toast({ title: "Deposit rejected" }); setRejectModal(null); setReason(""); invalidate(); },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Deposits</h1>
            <p className="text-sm text-muted-foreground">Review and approve deposit requests</p>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" data-testid="select-deposit-status">
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
              <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : data?.deposits?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No {status} deposits</div>
            ) : (
              <div className="divide-y divide-border">
                {data?.deposits?.map(d => (
                  <div key={d.id} className="px-4 py-4 space-y-2" data-testid={`admin-deposit-${d.id}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-bold">₹{parseFloat(d.amount ?? "0").toLocaleString("en-IN")}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[d.status ?? "pending"]}`}>
                            {d.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.userName ?? "Unknown"} · {d.userMobile}
                        </p>
                        <p className="text-xs text-muted-foreground">UTR: {d.utrNumber ?? "—"} · {d.paymentMethod?.toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.createdAt ? new Date(d.createdAt).toLocaleString("en-IN") : ""}
                        </p>
                        {d.screenshotUrl && (
                          <a
                            href={d.screenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 mt-1"
                            data-testid={`link-screenshot-${d.id}`}
                          >
                            <ExternalLink className="w-3 h-3" /> View screenshot
                          </a>
                        )}
                      </div>
                    </div>
                    {d.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => handleApprove(d.id!)}
                          disabled={approve.isPending}
                          data-testid={`button-approve-deposit-${d.id}`}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive border-red-200 hover:bg-red-50"
                          onClick={() => setRejectModal({ id: d.id! })}
                          data-testid={`button-reject-deposit-${d.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Deposit</DialogTitle></DialogHeader>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Rejection reason..." data-testid="input-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!reason.trim() || reject.isPending} data-testid="button-confirm-reject-deposit">
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
