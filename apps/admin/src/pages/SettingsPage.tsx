import { useQueryClient } from "@tanstack/react-query";
import type { FeatureFlag, PlatformSetting } from "@nexa/db-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nexa/design-system/src/components/ui/card";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";
import { FlagToggle } from "../components/flag-toggle";
import { SettingRow } from "../components/setting-row";
import { NotificationNumbers } from "../components/notification-numbers";

interface NotificationNumber {
  id: string;
  phone: string;
  label: string | null;
}

/**
 * Admin Console → Settings.
 *
 * Every number Nexa runs on is edited here and nowhere else. There is no
 * constant for any of them in the codebase, so changing one is never a deploy.
 */
export function SettingsPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();

  const settingsKey = ["settings-values"] as const;
  const flagsKey = ["settings-flags"] as const;
  const notificationNumbersKey = ["notification-numbers"] as const;

  const { data: settings } = useApiQuery<PlatformSetting[]>(settingsKey, "/settings/values");
  const { data: flags } = useApiQuery<FeatureFlag[]>(flagsKey, "/settings/flags");
  const { data: notificationNumbers } = useApiQuery<NotificationNumber[]>(
    notificationNumbersKey,
    "/admin/support/notification-numbers",
  );

  function reload() {
    queryClient.invalidateQueries({ queryKey: settingsKey });
    queryClient.invalidateQueries({ queryKey: flagsKey });
    queryClient.invalidateQueries({ queryKey: notificationNumbersKey });
  }

  if (!can(staff, P.settingsManage)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to manage settings.</p>;
  }

  if (!settings || !flags || !notificationNumbers) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

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
              <SettingRow key={setting.key} setting={setting} onChanged={reload} />
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
              <FlagToggle key={flag.key} flag={flag} onChanged={reload} />
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
          <NotificationNumbers numbers={notificationNumbers} onChanged={reload} />
        </CardContent>
      </Card>
    </div>
  );
}
