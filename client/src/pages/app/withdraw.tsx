import AppLayout from "@/components/AppLayout";
import { useGetWithdrawals, useCreateWithdrawal, useGetUpiAccounts, useGetWalletBalance, getGetWithdrawalsQueryKey, getGetWalletBalanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, IndianRupee, AlertCircle, ArrowDownToLine } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { ProviderLogo, getProviderName } from "@/components/ProviderLogo";

const withdrawSchema = z.object({
  amount: z.coerce.number().min(100, "Minimum sell request ₹100"),
  upiAccountId: z.string().min(1, "Select UPI account"),
});

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  processed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

const statusLabel: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  processed: "Approved",
  rejected: "Rejected",
};

export default function WithdrawPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: balance } = useGetWalletBalance();
  const { data: upiAccounts } = useGetUpiAccounts();
  const { data: withdrawals, isLoading } = useGetWithdrawals({ limit: 20 });
  const createWithdrawal = useCreateWithdrawal();

  const approvedUpiAccounts = upiAccounts?.accounts?.filter(a => a.status === "approved") ?? [];

  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 0, upiAccountId: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    createWithdrawal.mutate(
      { data: { amount: values.amount, upiAccountId: values.upiAccountId } },
      {
        onSuccess: () => {
          toast({ title: "Sell Request submitted", description: "Your wallet has been debited. Admin will process it shortly." });
          form.reset();
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: getGetWithdrawalsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWalletBalanceQueryKey() });
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
            <h1 className="text-2xl font-bold text-foreground">Sell Request</h1>
            <p className="text-sm text-muted-foreground">Withdraw your earnings to UPI</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-withdrawal">
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>

        <div className="p-4 bg-card rounded-xl border border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Available Balance</span>
          <span className="text-lg font-bold text-foreground">
            ₹{parseFloat(balance?.inrBalance ?? "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {approvedUpiAccounts.length === 0 && !showForm && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">No approved UPI accounts</p>
              <p className="text-amber-700 mt-0.5">
                You need at least one UPI account to submit a sell request.{" "}
                <Link href="/app/upi" className="underline font-semibold">Add UPI Account</Link>
              </p>
            </div>
          </div>
        )}

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">New Sell Request</CardTitle></CardHeader>
            <CardContent>
              {approvedUpiAccounts.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground text-sm">
                  No approved UPI accounts available.{" "}
                  <Link href="/app/upi" className="text-primary underline">Add one first</Link>
                </div>
              ) : (
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
                              <Input {...field} type="number" placeholder="500" className="pl-10" data-testid="input-withdrawal-amount" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="upiAccountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UPI Account</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-upi-account">
                                <SelectValue placeholder="Select UPI account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {approvedUpiAccounts.map(acc => (
                                <SelectItem key={acc.id!} value={acc.id!}>
                                  <div className="flex items-center gap-2">
                                    <ProviderLogo provider={acc.provider ?? ""} size={20} />
                                    <span className="font-mono text-sm">{acc.upiId}</span>
                                    {acc.isDefault && <span className="text-xs text-amber-600">· Default</span>}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-3">
                      <Button type="submit" disabled={createWithdrawal.isPending} data-testid="button-submit-withdrawal">
                        {createWithdrawal.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Submit Sell Request
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4" />
              Sell Request History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : withdrawals?.withdrawals?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No sell requests yet</div>
            ) : (
              <div className="divide-y divide-border">
                {withdrawals?.withdrawals?.map(w => (
                  <div key={w.id} className="px-4 py-3 flex items-center justify-between" data-testid={`withdrawal-row-${w.id}`}>
                    <div className="flex items-center gap-3">
                      <ProviderLogo provider={(w as any).provider ?? ""} size={32} />
                      <div>
                        <p className="text-sm font-semibold">₹{parseFloat(w.amount ?? "0").toLocaleString("en-IN")}</p>
                        <p className="text-xs text-muted-foreground font-mono">{(w as any).upiId}</p>
                        <p className="text-xs text-muted-foreground">{w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-IN") : ""}</p>
                        {w.rejectedReason && <p className="text-xs text-destructive mt-0.5">{w.rejectedReason}</p>}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColor[w.status ?? "pending"]}`}>
                      {statusLabel[w.status ?? "pending"] ?? w.status}
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
