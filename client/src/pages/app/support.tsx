import AppLayout from "@/components/AppLayout";
import { useGetSupportTickets, useCreateSupportTicket, getGetSupportTicketsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, HeadphonesIcon, MessageSquare } from "lucide-react";
import { useState } from "react";

const ticketSchema = z.object({
  subject: z.string().min(5, "Subject too short"),
  message: z.string().min(20, "Please describe your issue in detail"),
  attachmentUrl: z.string().url("Enter valid URL").optional().or(z.literal("")),
});

const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  closed: "bg-gray-100 text-gray-800",
};

export default function SupportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useGetSupportTickets();
  const createTicket = useCreateSupportTicket();

  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: "", message: "", attachmentUrl: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    createTicket.mutate(
      { data: { subject: values.subject, message: values.message, attachmentUrl: values.attachmentUrl || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Ticket created", description: "We'll get back to you shortly" });
          form.reset();
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: getGetSupportTicketsQueryKey() });
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Support</h1>
            <p className="text-sm text-muted-foreground">Get help from our team</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-ticket">
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Create Support Ticket</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={onSubmit} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Deposit not credited" data-testid="input-ticket-subject" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Describe your issue in detail..." rows={5} data-testid="input-ticket-message" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="attachmentUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attachment URL (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://..." data-testid="input-ticket-attachment" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3">
                    <Button type="submit" disabled={createTicket.isPending} data-testid="button-submit-ticket">
                      {createTicket.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Submit Ticket
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
              <div className="p-4 space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : data?.tickets?.length === 0 ? (
              <div className="py-12 text-center">
                <HeadphonesIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No support tickets</p>
                <p className="text-xs text-muted-foreground mt-1">Create a ticket if you need help</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data?.tickets?.map(t => (
                  <div key={t.id} className="px-4 py-4" data-testid={`ticket-${t.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm font-semibold truncate">{t.subject}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 capitalize ${statusColor[t.status ?? "open"]}`}>
                        {t.status?.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6 line-clamp-2">{t.message}</p>
                    {t.adminResponse && (
                      <div className="mt-3 pl-6">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs font-semibold text-foreground mb-1">Support Response:</p>
                          <p className="text-xs text-muted-foreground">{t.adminResponse}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-2 pl-6">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-IN") : ""}
                    </p>
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
