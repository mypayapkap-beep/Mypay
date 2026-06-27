import AdminLayout from "@/components/AdminLayout";
import {
  useAdminListTasks, useAdminCreateTask, useAdminUpdateTask, useAdminDeleteTask,
  useAdminListSubmissions, useAdminApproveSubmission, useAdminRejectSubmission,
  getAdminListTasksQueryKey, getAdminListSubmissionsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, CheckCircle, XCircle, IndianRupee } from "lucide-react";
import { useState } from "react";

const taskSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(10),
  amount: z.coerce.number().min(1),
  durationDays: z.coerce.number().min(1).default(7),
  maxSubmissions: z.coerce.number().min(0).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function AdminTasksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [subStatus, setSubStatus] = useState("pending");

  const { data: tasks, isLoading: tasksLoading } = useAdminListTasks({ limit: 50 });
  const { data: subs, isLoading: subsLoading } = useAdminListSubmissions({ status: subStatus, limit: 30 });
  const createTask = useAdminCreateTask();
  const deleteTask = useAdminDeleteTask();
  const approveSubmission = useAdminApproveSubmission();
  const rejectSubmission = useAdminRejectSubmission();

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { name: "", description: "", amount: 0, durationDays: 7, imageUrl: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    createTask.mutate(
      { data: { name: values.name, description: values.description, amount: values.amount, durationDays: values.durationDays, maxSubmissions: values.maxSubmissions, imageUrl: values.imageUrl || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Task created" });
          form.reset();
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: getAdminListTasksQueryKey({ limit: 50 }) });
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  });

  const handleApprove = (id: string) => {
    approveSubmission.mutate({ id }, {
      onSuccess: () => { toast({ title: "Submission approved, reward credited" }); queryClient.invalidateQueries({ queryKey: getAdminListSubmissionsQueryKey({ status: subStatus, limit: 30 }) }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
    });
  };

  const handleReject = () => {
    if (!rejectModal) return;
    rejectSubmission.mutate({ id: rejectModal.id, data: { reason: rejectReason } }, {
      onSuccess: () => { toast({ title: "Rejected" }); setRejectModal(null); setRejectReason(""); queryClient.invalidateQueries({ queryKey: getAdminListSubmissionsQueryKey({ status: subStatus, limit: 30 }) }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
    });
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
            <p className="text-sm text-muted-foreground">Manage tasks and review submissions</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} data-testid="button-create-task">
            <Plus className="w-4 h-4 mr-2" /> Create Task
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">New Task</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Task Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-task-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} rows={3} data-testid="input-task-desc" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reward (₹)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input {...field} type="number" className="pl-10" data-testid="input-task-amount" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="durationDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (days)</FormLabel>
                      <FormControl><Input {...field} type="number" data-testid="input-task-duration" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="maxSubmissions" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Submissions (0 = unlimited)</FormLabel>
                      <FormControl><Input {...field} type="number" data-testid="input-task-max" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL (optional)</FormLabel>
                      <FormControl><Input {...field} placeholder="https://..." data-testid="input-task-image" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="col-span-2 flex gap-3">
                    <Button type="submit" disabled={createTask.isPending} data-testid="button-submit-task">
                      {createTask.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Create Task
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks" data-testid="tab-admin-tasks">Tasks ({tasks?.tasks?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="submissions" data-testid="tab-admin-submissions">Submissions</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <Card>
              <CardContent className="p-0">
                {tasksLoading ? (
                  <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : (
                  <div className="divide-y divide-border">
                    {tasks?.tasks?.map(t => (
                      <div key={t.id} className="px-4 py-3 flex items-center gap-3" data-testid={`admin-task-${t.id}`}>
                        {t.imageUrl && <img src={t.imageUrl} alt={t.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ₹{parseFloat(t.amount ?? "0").toLocaleString("en-IN")} · {t.totalSubmissions ?? 0} submissions
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive shrink-0"
                          onClick={() => { deleteTask.mutate({ id: t.id! }, { onSuccess: () => { toast({ title: "Deleted" }); queryClient.invalidateQueries({ queryKey: getAdminListTasksQueryKey({ limit: 50 }) }); } }); }}
                          data-testid={`button-delete-task-${t.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions">
            <div className="flex gap-2 mb-4">
              {["pending", "approved", "rejected"].map(s => (
                <Button key={s} variant={subStatus === s ? "default" : "outline"} size="sm" onClick={() => setSubStatus(s)}
                  className="capitalize" data-testid={`filter-sub-${s}`}>{s}</Button>
              ))}
            </div>
            <Card>
              <CardContent className="p-0">
                {subsLoading ? (
                  <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : subs?.submissions?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No {subStatus} submissions</div>
                ) : (
                  <div className="divide-y divide-border">
                    {subs?.submissions?.map(s => (
                      <div key={s.id} className="px-4 py-3 flex items-start gap-3" data-testid={`admin-submission-${s.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{s.taskName ?? "Task"}</p>
                          <p className="text-xs text-muted-foreground">{s.userName} · {s.userMobile}</p>
                          <a href={s.proofImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline truncate block max-w-[300px]">
                            {s.proofImageUrl}
                          </a>
                          {s.taskAmount && <p className="text-xs text-emerald-600 font-semibold mt-0.5">₹{parseFloat(s.taskAmount).toLocaleString("en-IN")}</p>}
                        </div>
                        {s.status === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200"
                              onClick={() => handleApprove(s.id!)} disabled={approveSubmission.isPending}
                              data-testid={`button-approve-sub-${s.id}`}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive border-red-200"
                              onClick={() => setRejectModal({ id: s.id! })}
                              data-testid={`button-reject-sub-${s.id}`}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Submission</DialogTitle></DialogHeader>
          <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason..." data-testid="input-reject-sub-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()} data-testid="button-confirm-reject-sub">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
