import { getFlags, getSettings } from "@/modules/settings";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";
import { FlagToggle } from "./flag-toggle";
import { SettingRow } from "./setting-row";

/**
 * Admin Console → Settings.
 *
 * Commission and stage-1 release settings are edited
 * here and nowhere else. There is no constant for any of them in the codebase.
 */
export default async function AdminSettingsPage() {
  await requireView(P.settingsManage);
  const [settings, flags] = await Promise.all([getSettings(), getFlags()]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Commission, release percentages, and fees are edited here — never in code."
      />

      <Card>
        <h2 className="text-sm font-semibold">Platform settings</h2>
        <div className="mt-2">
          {settings.map((setting) => (
            <SettingRow key={setting.key} setting={setting} />
          ))}
          {settings.length === 0 ? (
            <p className="py-4 text-sm text-[color:var(--color-ink-muted)]">
              No settings found. Have the migrations been applied?
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold">Feature flags</h2>
        <p className="mt-1 text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
          The schema for every feature below already exists. These switches control
          who can see it. Turning one on is a config change, never a deployment.
        </p>
        <div className="mt-2">
          {flags.map((flag) => (
            <FlagToggle key={flag.key} flag={flag} />
          ))}
          {flags.length === 0 ? (
            <p className="py-4 text-sm text-[color:var(--color-ink-muted)]">
              No flags found. Have the migrations been applied?
            </p>
          ) : null}
        </div>
      </Card>
    </>
  );
}
