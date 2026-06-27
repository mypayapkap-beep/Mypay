import AdminLayout from "@/components/AdminLayout";
import { useAdminListDeposits, useAdminApproveDeposit, useAdminRejectDeposit, getAdminListDepositsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, FileCheck, Clock, ImageIcon, Copy } from "lucide-react";
import { useState } from "react";

const statusColor: Record<string, string> = {
  paying: "bg-blue-100 text-blue-800",
  pending: "bg-amber-100 text-amber-800",
  pending_verification: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

const statusLabel: Record<string, string> = {
  paying: "Paying",
  pending: "Pending",
  pending_verification: "Pending Verification",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
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

export default function AdminBuyRequestApprovalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending_verification");
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [reason, setReason] = useState("");
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null);

  const { data, isLoading } = useAdminListDeposits({ status, limit: 50 });
  const approve = useAdminApproveDeposit();
  const reject = useAdminRejectDeposit();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey({ status, limit: 50 }) });

  const handleApprove = (id: string) => {
    approve.mutate(
      { id, data: {} },
      {
        onSuccess: () => { toast({ title: "✅ Approved — wallet credited" }); invalidate(); },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      },
    );
  };

  const handleReject = () => {
    if (!rejectModal) return;
    reject.mutate(
      { id: rejectModal.id, data: { reason } },
      {
        onSuccess: () => {
          toast({ title: "Request rejected" });
          setRejectModal(null);
          setReason("");
          invalidate();
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      },
    );
  };

  const deposits = data?.deposits ?? [];

  const canAction = (s: string) => s === "pending" || s === "pending_verification";

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Buy Request Approval</h1>
            <p className="text-sm text-muted-foreground">Review user payment proofs (screenshot + UTR)</p>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_verification">Pending Verification</SelectItem>
              <SelectItem value="paying">Paying (waiting user)</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : deposits.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <FileCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No {statusLabel[status] ?? status} buy requests</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {deposits.map(d => {
                  const sellUpi: string | null = (d as any).userSellUpiId ?? null;
                  return (
                    <div key={d.id} className="px-5 py-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-base font-bold text-foreground">
                            ₹{parseFloat(d.amount ?? "0").toLocaleString("en-IN")}
                          </p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[d.status ?? "pending"]}`}>
                            {statusLabel[d.status ?? "pending"] ?? d.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">{d.userName ?? "Unknown"} · {d.userMobile}</p>
                        <div className="mt-1 space-y-0.5">
                          {(d as any).buyOrderTitle && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Order:</span>{" "}
                              {(d as any).buyOrderTitle}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="font-medium text-foreground">Sell UPI:</span>{" "}
                            {sellUpi ? (
                              <>
                                <span className="font-mono font-semibold text-foreground">{sellUpi}</span>
                                <CopyBtn text={sellUpi} />
                              </>
                            ) : (
                              <span className="italic">Sell UPI Not Added</span>
                            )}
                          </p>
                          {d.utrNumber && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">UTR:</span>{" "}
                              <span className="font-mono">{d.utrNumber}</span>
                            </p>
                          )}
                          {d.paymentMethod && (
                            <p className="text-xs text-muted-foreground">
                              Method: {d.paymentMethod.toUpperCase()}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {d.createdAt ? new Date(d.createdAt).toLocaleString("en-IN") : ""}
                          </p>
                          {d.screenshotUrl && (
                            <button
                              onClick={() => setScreenshotModal(d.screenshotUrl!)}
                              className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                            >
                              <ImageIcon className="w-3 h-3" /> View payment screenshot
                            </button>
                          )}
                        </div>
                      </div>

                      {d.status === "paying" ? (
                        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs text-blue-700 font-medium leading-tight">Waiting for<br />user payment</span>
                        </div>
                      ) : canAction(d.status ?? "") ? (
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleApprove(d.id!)}
                            disabled={approve.isPending}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-red-200 hover:bg-red-50"
                            onClick={() => setRejectModal({ id: d.id! })}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!screenshotModal} onOpenChange={(o) => !o && setScreenshotModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payment Screenshot</DialogTitle></DialogHeader>
          {screenshotModal && (
            <img
              src={screenshotModal}
              alt="Payment proof"
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Buy Request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Provide a reason for rejection. This will be shown to the user.</p>
          <Input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. UTR not matching, wrong amount, screenshot unclear..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!reason.trim() || reject.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
