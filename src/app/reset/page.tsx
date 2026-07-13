import { ResetForm } from "./reset-form";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Password reset, and the only door into an account Admin created for a vendor
 * or staff member — those are made with no password at all. The set-password
 * email links straight to `?step=code`, so the code box is already open.
 */
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; step?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <ResetForm
      email={firstParam(params.email)}
      startAtCode={firstParam(params.step) === "code"}
    />
  );
}
