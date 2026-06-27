import AdminLayout from "@/components/AdminLayout";
import { useGetPublicAnnouncements, useAdminCreateAnnouncement, useAdminDeleteAnnouncement, getGetPublicAnnouncementsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Megaphone } from "lucide-react";
import { useState } from "react";

const announcementSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(10),
  type: z.string().default("info"),
  isPinned: z.boolean().default(false),
});

export default function AdminAnnouncementsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useGetPublicAnnouncements();
  const createAnnouncement = useAdminCreateAnnouncement();
  const deleteAnnouncement = useAdminDeleteAnnouncement();

  const form = useForm<z.infer<typeof announcementSchema>>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", content: "", type: "info", isPinned: false },
  });

  const onSubmit = form.handleSubmit((values) => {
    createAnnouncement.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Announcement created" });
          form.reset();
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: getGetPublicAnnouncementsQueryKey() });
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  });

  const typeColor: Record<string, string> = {
    info: "bg-blue-100 text-blue-800",
    warning: "bg-amber-100 text-amber-800",
    success: "bg-emerald-100 text-emerald-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
            <p className="text-sm text-muted-foreground">Broadcast messages to all users</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-announcement">
            <Plus className="w-4 h-4 mr-2" /> New Announcement
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">New Announcement</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={onSubmit} className="space-y-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input {...field} data-testid="input-announcement-title" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="content" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl><Textarea {...field} rows={4} data-testid="input-announcement-content" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-announcement-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="success">Success</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="isPinned" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 mt-2">
                        <FormLabel className="text-sm font-normal">Pin announcement</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-pin-announcement" />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={createAnnouncement.isPending} data-testid="button-submit-announcement">
                      {createAnnouncement.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Publish
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : data?.announcements?.length === 0 ? (
              <div className="p-8 text-center">
                <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No announcements yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data?.announcements?.map(a => (
                  <div key={a.id} className="px-4 py-4 flex items-start gap-3" data-testid={`announcement-row-${a.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{a.title}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${typeColor[a.type ?? "info"]}`}>{a.type}</span>
                        {a.isPinned && <Badge variant="secondary" className="text-xs">Pinned</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.content}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-IN") : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="text-destructive shrink-0"
                      onClick={() => deleteAnnouncement.mutate({ id: a.id! }, { onSuccess: () => { toast({ title: "Deleted" }); queryClient.invalidateQueries({ queryKey: getGetPublicAnnouncementsQueryKey() }); } })}
                      data-testid={`button-delete-announcement-${a.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
