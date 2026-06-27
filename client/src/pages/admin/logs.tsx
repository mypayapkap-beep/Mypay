import AdminLayout from "@/components/AdminLayout";
import { useAdminGetLogs } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Search } from "lucide-react";
import { useState } from "react";

export default function AdminLogsPage() {
  const [action, setAction] = useState("");
  const { data, isLoading } = useAdminGetLogs({ action: action || undefined, limit: 50 });

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Admin activity log</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={action}
            onChange={e => setAction(e.target.value)}
            placeholder="Filter by action..."
            className="pl-10"
            data-testid="input-log-filter"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : data?.logs?.length === 0 ? (
              <div className="p-8 text-center">
                <ScrollText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No audit logs found</p>
              </div>
            ) : (
              <div className="divide-y divide-border font-mono text-xs">
                {data?.logs?.map((log: any, i: number) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-4" data-testid={`log-row-${i}`}>
                    <span className="text-muted-foreground shrink-0 w-32 truncate">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("en-IN") : ""}
                    </span>
                    <span className="text-primary font-semibold shrink-0">{log.action}</span>
                    <span className="text-muted-foreground flex-1 truncate">
                      {log.targetType && <span>{log.targetType}: </span>}
                      {log.targetId && <span className="text-foreground">{log.targetId}</span>}
                      {log.metadata && <span className="ml-2 text-muted-foreground/60">{JSON.stringify(log.metadata)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
