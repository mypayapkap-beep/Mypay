import AdminLayout from "@/components/AdminLayout";
import { adminApi } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Send, FileText, Layout, Bot, ToggleLeft, ToggleRight } from "lucide-react";
import { useState, useEffect } from "react";

const TELEGRAM_KEYS = [
  { key: "telegram_bot_username", label: "Bot Username", desc: "Telegram bot username (without @)", placeholder: "mypay_bot" },
  { key: "telegram_channel_link", label: "Channel / Group Link", desc: "Invite link for your Telegram channel or group (shown as banner on home page)", placeholder: "https://t.me/mypay" },
  { key: "telegram_support_username", label: "Support Username", desc: "Support agent Telegram username (shown in Account page Contact)", placeholder: "mypay_support" },
];

const BOT_KEYS = [
  { key: "telegram_bot_token", label: "Bot Token", desc: "Telegram Bot API token from @BotFather (keep secret)", placeholder: "123456:ABC-DEF1234..." },
  { key: "telegram_group_id", label: "Group / Channel ID", desc: "Numeric ID of the group or channel the bot will post to (e.g. -1001234567890)", placeholder: "-1001234567890" },
];

const BANNER_KEYS = [
  { key: "terms_content", label: "Terms & Rules Content", desc: "Platform rules shown on the Terms page (one rule per line, use '1. Heading' or '- bullet' format)", placeholder: "1. Platform Rules\n- Users must complete tasks honestly...", multiline: true },
];

export default function AdminTelegramSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const ALL_KEYS = [...TELEGRAM_KEYS, ...BOT_KEYS, ...BANNER_KEYS, { key: "telegram_bot_enabled", label: "", desc: "", placeholder: "" }];

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminApi.getSettings(),
  });

  useEffect(() => {
    if (!data?.settings) return;
    const map: Record<string, string> = {};
    for (const s of data.settings) {
      if (ALL_KEYS.some(k => k.key === s.key)) map[s.key] = s.value;
    }
    setValues(map);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      for (const { key } of ALL_KEYS) {
        if (values[key] !== undefined) {
          await adminApi.updateSetting(key, values[key]);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
  });

  const botEnabled = values["telegram_bot_enabled"] === "true";

  const toggleBot = () => {
    setValues(v => ({ ...v, telegram_bot_enabled: botEnabled ? "false" : "true" }));
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Send className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Telegram & Content Settings</h1>
            <p className="text-sm text-muted-foreground">Configure Telegram links, bot settings, and home page content banners</p>
          </div>
        </div>

        {/* Telegram Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-500" />
              Telegram Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : (
              TELEGRAM_KEYS.map(({ key, label, desc, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-foreground">{label}</label>
                  <p className="text-xs text-muted-foreground mb-1.5">{desc}</p>
                  <Input
                    placeholder={placeholder}
                    value={values[key] ?? ""}
                    onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Telegram Bot (Booster) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-500" />
              Telegram Bot (Booster)
              <Badge className={botEnabled ? "bg-emerald-100 text-emerald-700 text-xs ml-auto" : "bg-muted text-muted-foreground text-xs ml-auto"}>
                {botEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-amber-700 text-xs leading-relaxed">
                <strong>Prepared for future activation.</strong> Once billing is enabled on Firebase and you have a Telegram Bot Token, enable this to send automatic status replies (🚀 ⏳ ✅ ❌) to your group without any code changes.
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : (
              <>
                {BOT_KEYS.map(({ key, label, desc, placeholder }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-foreground">{label}</label>
                    <p className="text-xs text-muted-foreground mb-1.5">{desc}</p>
                    <Input
                      placeholder={placeholder}
                      value={values[key] ?? ""}
                      type={key === "telegram_bot_token" ? "password" : "text"}
                      onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                    />
                  </div>
                ))}

                <div>
                  <label className="text-sm font-medium text-foreground">Bot Status</label>
                  <p className="text-xs text-muted-foreground mb-2">Enable to allow the bot to post automatic sell request updates to the group.</p>
                  <button
                    type="button"
                    onClick={toggleBot}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    {botEnabled ? (
                      <ToggleRight className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className={`text-sm font-medium ${botEnabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {botEnabled ? "Bot Enabled — will send messages" : "Bot Disabled — no messages sent"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Home Banner Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layout className="w-4 h-4 text-primary" />
              Home Page Banners
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              The <strong>Telegram Banner</strong> on the home page is automatically shown when a Telegram Channel Link is set above.
              The <strong>Terms &amp; Rules Banner</strong> always links to the Terms page.
            </p>
          </CardContent>
        </Card>

        {/* Terms Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Terms &amp; Rules Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              BANNER_KEYS.map(({ key, label, desc, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-foreground">{label}</label>
                  <p className="text-xs text-muted-foreground mb-1.5">{desc}</p>
                  <Textarea
                    placeholder={placeholder}
                    value={values[key] ?? ""}
                    onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                    rows={10}
                    className="font-mono text-xs"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full">
          {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          <Save className="w-4 h-4 mr-2" /> Save All Settings
        </Button>

        <Card className="border-muted bg-muted/30">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-semibold">How banners work:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Telegram Banner</strong> — shown when Channel Link is configured. Links users directly to your Telegram channel.</li>
              <li><strong>Terms &amp; Rules Banner</strong> — always visible on home. Clicking opens the Terms page with the content above.</li>
              <li><strong>Home Banners</strong> — image banners managed via the <a href="/admin/banners" className="text-primary underline">Banners page</a>.</li>
              <li><strong>Telegram Bot</strong> — when enabled with a valid token, sends 🚀 ⏳ ✅ ❌ status messages to your group for sell requests.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
