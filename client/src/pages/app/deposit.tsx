import AppLayout from "@/components/AppLayout";
import { useGetDeposits, useCreateDeposit, getGetDepositsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, IndianRupee } from "lucide-react";
import { useState } from "react";

const depositSchema = z.object({
  amount: z.coerce.number().min(100, "Minimum deposit ₹100"),
  utrNumber: z.string().min(12, "Enter valid UTR number"),
  paymentMethod: z.string().min(1, "Select payment method"),
  screenshotUrl: z.string().url("Enter valid screenshot URL").optional().or(z.literal("")),
});

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function DepositPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: deposits, isLoading } = useGetDeposits({ limit: 20 });
  const createDeposit = useCreateDeposit();

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 0, utrNumber: "", paymentMethod: "", screenshotUrl: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    createDeposit.mutate(
      {
        data: {
          amount: values.amount,
          utrNumber: values.utrNumber,
          paymentMethod: values.paymentMethod,
          screenshotUrl: values.screenshotUrl || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Deposit request submitted", description: "Admin will approve within 24 hours" });
          form.reset();
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: getGetDepositsQueryKey() });
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed to submit", variant: "destructive" }),
      }
    );
  });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Deposit</h1>
            <p className="text-sm text-muted-foreground">Add money to your wallet</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-deposit">
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Submit Deposit Request</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={onSubmit} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (INR)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input {...field} type="number" placeholder="500" className="pl-10" data-testid="input-deposit-amount" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payment-method">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="neft">NEFT</SelectItem>
                            <SelectItem value="imps">IMPS</SelectItem>
                            <SelectItem value="rtgs">RTGS</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="utrNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UTR / Transaction ID</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="HDFC00012345678" data-testid="input-utr" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="screenshotUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Screenshot URL (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://..." data-testid="input-screenshot" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3">
                    <Button type="submit" disabled={createDeposit.isPending} data-testid="button-submit-deposit">
                      {createDeposit.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Submit Request
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Your Deposits</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : deposits?.deposits?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No deposit requests yet</div>
            ) : (
              <div className="divide-y divide-border">
                {deposits?.deposits?.map(d => (
                  <div key={d.id} className="px-4 py-3 flex items-center justify-between" data-testid={`deposit-row-${d.id}`}>
                    <div>
                      <p className="text-sm font-semibold">₹{parseFloat(d.amount ?? "0").toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground">{d.utrNumber} · {d.paymentMethod?.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{d.createdAt ? new Date(d.createdAt).toLocaleDateString("en-IN") : ""}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColor[d.status ?? "pending"]}`}>
                      {d.status}
                    </span>
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
