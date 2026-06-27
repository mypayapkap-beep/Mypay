import AdminLayout from "@/components/AdminLayout";
import { useAdminListSupportTickets, useAdminRespondToTicket, getAdminListSupportTicketsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { HeadphonesIcon, MessageSquare, Loader2 } from "lucide-react";
import { useState } from "react";

const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  closed: "bg-gray-100 text-gray-800",
};

export default function AdminSupportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("open");
  const [respondModal, setRespondModal] = useState<{ id: string; subject: string } | null>(null);
  const [response, setResponse] = useState("");
  const [respStatus, setRespStatus] = useState("resolved");

  const { data, isLoading } = useAdminListSupportTickets({ status, limit: 30 });
  const respondToTicket = useAdminRespondToTicket();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListSupportTicketsQueryKey({ status, limit: 30 }) });

  const handleRespond = () => {
    if (!respondModal) return;
    respondToTicket.mutate(
      { id: respondModal.id, data: { response, status: respStatus } },
      {
        onSuccess: () => {
          toast({ title: "Response sent" });
          setRespondModal(null);
          setResponse("");
          setRespStatus("resolved");
          invalidate();
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
            <p className="text-sm text-muted-foreground">Respond to user support requests</p>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40" data-testid="select-support-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : data?.tickets?.length === 0 ? (
              <div className="p-8 text-center">
                <HeadphonesIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No {status} tickets</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data?.tickets?.map(t => (
                  <div key={t.id} className="px-4 py-4 flex items-start gap-3" data-testid={`admin-ticket-${t.id}`}>
                    <MessageSquare className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold">{t.subject}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${statusColor[t.status ?? "open"]}`}>
                          {t.status?.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{t.userName} · {t.userMobile}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.message}</p>
                      {t.adminResponse && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <span className="font-semibold">Response: </span>{t.adminResponse}
                        </div>
                      )}
                    </div>
                    {(t.status === "open" || t.status === "in_progress") && (
                      <Button
                        size="sm" variant="outline"
                        onClick={() => setRespondModal({ id: t.id!, subject: t.subject! })}
                        data-testid={`button-respond-${t.id}`}
                      >
                        Respond
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!respondModal} onOpenChange={(o) => !o && setRespondModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {respondModal && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{respondModal.subject}</p>
              </div>
            )}
            <Textarea
              value={response}
              onChange={e => setResponse(e.target.value)}
              placeholder="Type your response..."
              rows={5}
              data-testid="input-support-response"
            />
            <Select value={respStatus} onValueChange={setRespStatus}>
              <SelectTrigger data-testid="select-ticket-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">Mark In Progress</SelectItem>
                <SelectItem value="resolved">Mark Resolved</SelectItem>
                <SelectItem value="closed">Mark Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondModal(null)}>Cancel</Button>
            <Button
              onClick={handleRespond}
              disabled={!response.trim() || respondToTicket.isPending}
              data-testid="button-send-response"
            >
              {respondToTicket.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Send Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
