import AdminLayout from "@/components/AdminLayout";
import {
  useAdminListUsers, useAdminSuspendUser, useAdminUnsuspendUser,
  useAdminBlockUser, useAdminUnblockUser, useAdminFreezeWallet,
  useAdminUnfreezeWallet, getAdminListUsersQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Search, Copy } from "lucide-react";
import { useState } from "react";

type Action = "suspend" | "block" | "freeze" | null;

function CopyBtn({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!" });
      }}
      title="Copy"
    >
      <Copy className="w-3 h-3" />
    </button>
  );
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [actionModal, setActionModal] = useState<{ action: Action; userId: string; userName: string } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useAdminListUsers({ search, limit: 30 });
  const suspendUser = useAdminSuspendUser();
  const unsuspendUser = useAdminUnsuspendUser();
  const blockUser = useAdminBlockUser();
  const unblockUser = useAdminUnblockUser();
  const freezeWallet = useAdminFreezeWallet();
  const unfreezeWallet = useAdminUnfreezeWallet();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey({ search, limit: 30 }) });

  const handleAction = () => {
    if (!actionModal) return;
    const { action, userId } = actionModal;
    const opts = {
      onSuccess: () => { toast({ title: "Done" }); setActionModal(null); setReason(""); invalidate(); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
    };
    if (action === "suspend") suspendUser.mutate({ id: userId, data: { reason } }, opts);
    if (action === "block") blockUser.mutate({ id: userId, data: { reason } }, opts);
    if (action === "freeze") freezeWallet.mutate({ id: userId, data: { reason } }, opts);
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">Manage user accounts</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or mobile..."
            className="pl-10"
            data-testid="input-user-search"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : data?.users?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No users found</div>
            ) : (
              <div className="divide-y divide-border">
                {data?.users?.map(u => {
                  const sellUpi: string | null = (u as any).sellUpiId ?? null;
                  return (
                    <div key={u.id} className="px-4 py-3 flex items-center gap-3" data-testid={`admin-user-row-${u.id}`}>
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                        {(u.name ?? "U")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.mobile}</p>
                        {sellUpi ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span>Sell UPI: <span className="font-mono font-medium text-foreground">{sellUpi}</span></span>
                            <CopyBtn text={sellUpi} />
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Sell UPI Not Added</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {u.isSuspended && <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">Suspended</Badge>}
                        {u.isBlocked && <Badge variant="destructive" className="text-xs">Blocked</Badge>}
                        {u.walletFrozen && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">Frozen</Badge>}
                        {u.inrBalance != null && (
                          <span className="text-xs text-muted-foreground">₹{parseFloat(u.inrBalance).toLocaleString("en-IN")}</span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-user-actions-${u.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!u.isSuspended ? (
                              <DropdownMenuItem
                                onClick={() => setActionModal({ action: "suspend", userId: u.id!, userName: u.name ?? "" })}
                                className="text-amber-600"
                                data-testid={`action-suspend-${u.id}`}
                              >
                                Suspend User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => { unsuspendUser.mutate({ id: u.id! }, { onSuccess: () => { toast({ title: "Unsuspended" }); invalidate(); } }); }}
                                data-testid={`action-unsuspend-${u.id}`}
                              >
                                Unsuspend User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {!u.isBlocked ? (
                              <DropdownMenuItem
                                onClick={() => setActionModal({ action: "block", userId: u.id!, userName: u.name ?? "" })}
                                className="text-destructive"
                                data-testid={`action-block-${u.id}`}
                              >
                                Block User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => { unblockUser.mutate({ id: u.id! }, { onSuccess: () => { toast({ title: "Unblocked" }); invalidate(); } }); }}
                                data-testid={`action-unblock-${u.id}`}
                              >
                                Unblock User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {!u.walletFrozen ? (
                              <DropdownMenuItem
                                onClick={() => setActionModal({ action: "freeze", userId: u.id!, userName: u.name ?? "" })}
                                className="text-blue-600"
                                data-testid={`action-freeze-${u.id}`}
                              >
                                Freeze Wallet
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => { unfreezeWallet.mutate({ id: u.id! }, { onSuccess: () => { toast({ title: "Unfrozen" }); invalidate(); } }); }}
                                data-testid={`action-unfreeze-${u.id}`}
                              >
                                Unfreeze Wallet
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!actionModal} onOpenChange={(o) => !o && setActionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionModal?.action === "freeze" ? "Freeze Wallet" : `${actionModal?.action} User`}
            </DialogTitle>
          </DialogHeader>
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              User: <span className="font-semibold text-foreground">{actionModal?.userName}</span>
            </p>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason..."
              data-testid="input-action-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleAction}
              disabled={!reason.trim()}
              data-testid="button-confirm-action"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
