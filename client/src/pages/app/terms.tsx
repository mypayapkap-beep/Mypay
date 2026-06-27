import AppLayout from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";

const _apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function usePublicSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch(`${_apiBase}/api/public/settings`).then(r => r.json()) as Promise<{ settings: Record<string, string> }>,
    staleTime: 60_000,
  });
}

const DEFAULT_TERMS = `
1. Platform Rules
- Users must complete tasks honestly and accurately.
- Fraudulent activity, fake screenshots, or false UTR numbers will result in permanent account suspension.
- Each user is allowed one account only. Multiple accounts are not permitted.

2. Deposits & Buy Orders
- All deposits must match the exact amount shown in the buy order.
- Upload a clear screenshot showing the full transaction including UTR/reference number.
- Admin approval may take up to 24 hours on business days.
- Once a deposit is confirmed, the token credit and 5% income are added to your balance.

3. Withdrawals
- Withdrawals are processed within 24–72 hours.
- Minimum withdrawal amount applies as configured by the platform.
- Withdrawal requests are subject to admin review and verification.

4. Referral Program
- You earn a referral bonus when your referred user completes their first approved deposit.
- Referral bonuses are credited up to 3 levels deep.
- Referral abuse or fake referrals will result in disqualification and account ban.

5. Account & Security
- Keep your login credentials secure. Do not share your password.
- The platform is not responsible for losses due to account sharing.
- Users are responsible for keeping their UPI ID and banking details up to date.

6. Prohibited Activities
- Using automated bots or scripts to interact with the platform.
- Attempting to exploit bugs or vulnerabilities for financial gain.
- Spamming or harassing other users or admins.

7. Amendments
- The platform reserves the right to update these rules at any time.
- Continued use of the platform constitutes acceptance of any changes.

8. Contact & Support
- For support, contact us via the Telegram support channel listed in the app.
- All disputes must be raised within 48 hours of the transaction.
`;

export default function TermsPage() {
  const { data: settingsData } = usePublicSettings();
  const settings = settingsData?.settings ?? {};
  const termsContent = settings["terms_content"] || DEFAULT_TERMS;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Terms & Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform guidelines and policies</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="prose prose-sm max-w-none text-foreground">
            {termsContent.trim().split("\n").map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              if (/^\d+\./.test(line.trim())) {
                return (
                  <h3 key={i} className="font-bold text-base mt-4 mb-2 text-foreground">
                    {line.trim()}
                  </h3>
                );
              }
              if (line.trim().startsWith("-")) {
                return (
                  <p key={i} className="text-sm text-muted-foreground pl-3 mb-1">
                    {line.trim()}
                  </p>
                );
              }
              return (
                <p key={i} className="text-sm text-muted-foreground mb-2">
                  {line.trim()}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
