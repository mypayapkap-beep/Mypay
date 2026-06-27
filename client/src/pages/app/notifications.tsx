import AppLayout from "@/components/AppLayout";
import { useGetNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryIcon: Record<string, string> = {
  deposit: "💳", withdrawal: "💸", task: "✅", referral: "👥",
  system: "🔔", support: "🎧", wallet: "👛",
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetNotifications({ limit: 30 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey({ unread: true, limit: 1 }) });
  };

  const handleMarkRead = (id: string) => {
    markRead.mutate({ id }, {
      onSuccess: () => invalidate(),
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  const handleMarkAll = () => {
    markAll.mutate(undefined as any, {
      onSuccess: () => { toast({ title: "All marked as read" }); invalidate(); },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            {data?.unreadCount != null && data.unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">{data.unreadCount} unread</p>
            )}
          </div>
          {(data?.unreadCount ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAll} data-testid="button-mark-all-read">
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : data?.notifications?.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">All caught up</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data?.notifications?.map(n => (
                  <div
                    key={n.id}
                    className={cn("px-4 py-3 flex items-start gap-3", !n.isRead && "bg-primary/5")}
                    data-testid={`notification-${n.id}`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{categoryIcon[n.category ?? "system"] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground">{n.title}</p>
                        {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString("en-IN") : ""}
                      </p>
                    </div>
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs shrink-0"
                        onClick={() => handleMarkRead(n.id!)}
                        data-testid={`button-mark-read-${n.id}`}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
