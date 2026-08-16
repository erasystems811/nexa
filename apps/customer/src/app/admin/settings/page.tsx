import { getFlags, getSettings } from "@/modules/settings";
import { requireView, listNotificationNumbers, PERMISSIONS as P } from "@/modules/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlagToggle } from "./flag-toggle";
import { SettingRow } from "./setting-row";
import { NotificationNumbers } from "./notification-numbers";

/**
 * Admin Console → Settings.
 *
 * Every number Nexa runs on is edited here and nowhere else. There is no
 * constant for any of them in the codebase, so changing one is never a deploy.
 */
export default async function AdminSettingsPage() {
  await requireView(P.settingsManage);
  const [settings, flags, notificationNumbers] = await Promise.all([
    getSettings(),
    getFlags(),
    listNotificationNumbers(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-3xl font-serif font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">The numbers Nexa runs on. Change them here — never in code.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform settings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {settings.map((setting) => (
              <SettingRow key={setting.key} setting={setting} />
            ))}
            {settings.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                No settings found. Have the migrations been applied?
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature flags</CardTitle>
          <CardDescription>
            The schema for every feature below already exists. These switches control who can see
            it. Turning one on is a config change, never a deployment.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {flags.map((flag) => (
              <FlagToggle key={flag.key} flag={flag} />
            ))}
            {flags.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                No flags found. Have the migrations been applied?
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Support notifications</CardTitle>
          <CardDescription>
            Every number here gets a WhatsApp message the moment a customer types &ldquo;help&rdquo;
            to the bot, or submits the website contact form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationNumbers numbers={notificationNumbers} />
        </CardContent>
      </Card>
    </div>
  );
}
