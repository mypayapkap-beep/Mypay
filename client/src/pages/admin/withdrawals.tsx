import AdminLayout from "@/components/AdminLayout";
import { useAdminListWithdrawals, useAdminProcessWithdrawal, useAdminRejectWithdrawal, getAdminListWithdrawalsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Copy } from "lucide-react";
import { useState } from "react";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  processed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

const statusLabel: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  processed: "Approved",
  rejected: "Rejected",
};

function CopyBtn({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline ml-1"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!" });
      }}
      title="Copy"
    >
      <Copy className="w-3 h-3" />
    </button>
  );
}

export default function AdminWithdrawalsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useAdminListWithdrawals({ status, limit: 30 });
  const process = useAdminProcessWithdrawal();
  const reject = useAdminRejectWithdrawal();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey({ status, limit: 30 }) });

  const handleProcess = (id: string) => {
    process.mutate(
      { id, data: {} },
      {
        onSuccess: () => { toast({ title: "Sell request approved" }); invalidate(); },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  };

  const handleReject = () => {
    if (!rejectModal) return;
    reject.mutate(
      { id: rejectModal.id, data: { reason } },
      {
        onSuccess: () => { toast({ title: "Sell request rejected (refunded)" }); setRejectModal(null); setReason(""); invalidate(); },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sell Requests</h1>
            <p className="text-sm text-muted-foreground">Manage user sell (withdrawal) requests</p>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" data-testid="select-withdrawal-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="processed">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : data?.withdrawals?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No {status} sell requests</div>
            ) : (
              <div className="divide-y divide-border">
                {data?.withdrawals?.map(w => {
                  const sellUpi: string | null = (w as any).userSellUpi ?? (w as any).profileSellUpiId ?? null;
                  return (
                    <div key={w.id} className="px-4 py-4 flex items-start gap-4" data-testid={`admin-withdrawal-${w.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold">₹{parseFloat(w.amount ?? "0").toLocaleString("en-IN")}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[w.status ?? "pending"]}`}>
                            {statusLabel[w.status ?? "pending"] ?? w.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{w.userName ?? "Unknown"} · {w.userMobile}</p>
                        {(w as any).userId && (
                          <p className="text-xs text-muted-foreground">
                            User ID: <span className="font-mono">{(w as any).userId}</span>
                          </p>
                        )}
                        {w.upiId && (
                          <p className="text-xs text-muted-foreground">
                            UPI: <span className="font-mono">{w.upiId}</span>
                            <CopyBtn text={w.upiId} />
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          Sell UPI:{" "}
                          {sellUpi ? (
                            <>
                              <span className="font-mono font-semibold text-foreground">{sellUpi}</span>
                              <CopyBtn text={sellUpi} />
                            </>
                          ) : (
                            <span className="italic text-muted-foreground">Not set</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {w.createdAt ? new Date(w.createdAt).toLocaleString("en-IN") : ""}
                        </p>
                        {w.status === "rejected" && (w as any).rejectedReason && (
                          <p className="text-xs text-destructive mt-0.5">Reason: {(w as any).rejectedReason}</p>
                        )}
                      </div>
                      {(w.status === "pending" || w.status === "processing") && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => handleProcess(w.id!)}
                            disabled={process.isPending}
                            data-testid={`button-process-withdrawal-${w.id}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-red-200 hover:bg-red-50"
                            onClick={() => setRejectModal({ id: w.id! })}
                            data-testid={`button-reject-withdrawal-${w.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
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

      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Sell Request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Amount will be refunded to user's wallet.</p>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Rejection reason..." data-testid="input-reject-reason-wd" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!reason.trim() || reject.isPending} data-testid="button-confirm-reject-wd">
              Reject & Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
