import AppLayout from "@/components/AppLayout";
import { useGetTasks, useGetMyTaskSubmissions, useSubmitTask, getGetMyTaskSubmissionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, IndianRupee, Clock } from "lucide-react";
import { useState } from "react";

const submitSchema = z.object({
  proofImageUrl: z.string().url("Enter a valid image URL"),
  notes: z.string().optional(),
});

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function TasksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<{ id: string; name: string; amount: string } | null>(null);
  const { data: tasks, isLoading: tasksLoading } = useGetTasks({ limit: 20 });
  const { data: submissions, isLoading: subLoading } = useGetMyTaskSubmissions({ limit: 20 });
  const submitTask = useSubmitTask();

  const form = useForm<z.infer<typeof submitSchema>>({
    resolver: zodResolver(submitSchema),
    defaultValues: { proofImageUrl: "", notes: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!selectedTask) return;
    submitTask.mutate(
      { id: selectedTask.id, data: { proofImageUrl: values.proofImageUrl, notes: values.notes } },
      {
        onSuccess: () => {
          toast({ title: "Submission received", description: "Admin will review and credit reward" });
          form.reset();
          setSelectedTask(null);
          queryClient.invalidateQueries({ queryKey: getGetMyTaskSubmissionsQueryKey() });
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  });

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">Complete tasks and earn rewards</p>
        </div>

        <Tabs defaultValue="browse">
          <TabsList>
            <TabsTrigger value="browse" data-testid="tab-browse-tasks">Browse Tasks</TabsTrigger>
            <TabsTrigger value="mine" data-testid="tab-my-submissions">My Submissions</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            {tasksLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
              </div>
            ) : tasks?.tasks?.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No tasks available right now</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tasks?.tasks?.map(task => (
                  <Card key={task.id} className="overflow-hidden" data-testid={`task-card-${task.id}`}>
                    {task.imageUrl && (
                      <div className="h-32 overflow-hidden">
                        <img src={task.imageUrl} alt={task.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-foreground text-sm leading-tight">{task.name}</h3>
                        <span className="text-emerald-600 font-bold text-sm ml-2 shrink-0 flex items-center gap-0.5">
                          <IndianRupee className="w-3 h-3" />{parseFloat(task.amount ?? "0").toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {task.durationDays}d
                          {task.maxSubmissions && (
                            <span className="ml-2">{task.totalSubmissions}/{task.maxSubmissions} taken</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setSelectedTask({ id: task.id!, name: task.name!, amount: task.amount! })}
                          data-testid={`button-submit-task-${task.id}`}
                        >
                          Submit Proof
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine">
            <Card>
              <CardContent className="p-0">
                {subLoading ? (
                  <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : submissions?.submissions?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No submissions yet</div>
                ) : (
                  <div className="divide-y divide-border">
                    {submissions?.submissions?.map(s => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between" data-testid={`submission-row-${s.id}`}>
                        <div>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{s.proofImageUrl}</p>
                          {s.notes && <p className="text-xs text-muted-foreground mt-0.5">{s.notes}</p>}
                          {s.rejectedReason && <p className="text-xs text-destructive mt-0.5">{s.rejectedReason}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">{s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN") : ""}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColor[s.status ?? "pending"]}`}>
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Proof</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div>
                <div className="p-3 bg-muted rounded-lg mb-4 text-sm">
                  <p className="font-medium">{selectedTask.name}</p>
                  <p className="text-emerald-600 font-bold">Reward: ₹{parseFloat(selectedTask.amount).toLocaleString("en-IN")}</p>
                </div>
                <Form {...form}>
                  <form onSubmit={onSubmit} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="proofImageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Screenshot URL</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://..." data-testid="input-proof-url" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Additional notes..." rows={3} data-testid="input-proof-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-3">
                      <Button type="submit" disabled={submitTask.isPending} data-testid="button-confirm-submit-task">
                        {submitTask.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Submit
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setSelectedTask(null)}>Cancel</Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
