import { VerifyForm } from "./verify-form";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const params = await searchParams;
  return <VerifyForm email={firstParam(params.email)} />;
}
