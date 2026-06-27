import AdminLayout from "@/components/AdminLayout";
import { useGetPublicBanners, useAdminCreateBanner, useAdminDeleteBanner, getGetPublicBannersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Image } from "lucide-react";
import { useState } from "react";

const bannerSchema = z.object({
  title: z.string().min(2),
  imageUrl: z.string().url("Enter valid image URL"),
  linkUrl: z.string().url().optional().or(z.literal("")),
  sortOrder: z.coerce.number().default(0),
});

export default function AdminBannersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useGetPublicBanners();
  const createBanner = useAdminCreateBanner();
  const deleteBanner = useAdminDeleteBanner();

  const form = useForm<z.infer<typeof bannerSchema>>({
    resolver: zodResolver(bannerSchema),
    defaultValues: { title: "", imageUrl: "", linkUrl: "", sortOrder: 0 },
  });

  const onSubmit = form.handleSubmit((values) => {
    createBanner.mutate(
      { data: { title: values.title, imageUrl: values.imageUrl, linkUrl: values.linkUrl || undefined, sortOrder: values.sortOrder } },
      {
        onSuccess: () => {
          toast({ title: "Banner created" });
          form.reset();
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: getGetPublicBannersQueryKey() });
        },
        onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  });

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Banners</h1>
            <p className="text-sm text-muted-foreground">Manage promotional banners shown to users</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-banner">
            <Plus className="w-4 h-4 mr-2" /> Add Banner
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">New Banner</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={onSubmit} className="space-y-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input {...field} data-testid="input-banner-title" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl><Input {...field} placeholder="https://..." data-testid="input-banner-image" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="linkUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link URL (optional)</FormLabel>
                      <FormControl><Input {...field} placeholder="https://..." data-testid="input-banner-link" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="sortOrder" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl><Input {...field} type="number" data-testid="input-banner-sort" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex gap-3">
                    <Button type="submit" disabled={createBanner.isPending} data-testid="button-submit-banner">
                      {createBanner.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Create Banner
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
              <div className="p-4 space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : data?.banners?.length === 0 ? (
              <div className="p-8 text-center">
                <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No banners yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data?.banners?.map(b => (
                  <div key={b.id} className="flex items-center gap-4 px-4 py-3" data-testid={`banner-row-${b.id}`}>
                    <div className="w-20 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{b.title}</p>
                      {b.linkUrl && <p className="text-xs text-primary truncate">{b.linkUrl}</p>}
                      <p className="text-xs text-muted-foreground">Order: {b.sortOrder}</p>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="text-destructive shrink-0"
                      onClick={() => deleteBanner.mutate({ id: b.id! }, { onSuccess: () => { toast({ title: "Deleted" }); queryClient.invalidateQueries({ queryKey: getGetPublicBannersQueryKey() }); } })}
                      data-testid={`button-delete-banner-${b.id}`}
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
