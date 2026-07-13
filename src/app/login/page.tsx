import { headers } from "next/headers";
import { surfaceForHost, type Surface } from "@/lib/surfaces";
import { LoginForm } from "./login-form";

function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "";
  return next;
}

function inferredNext(surface: Surface | null): string {
  if (surface === "admin") return "/admin";
  if (surface === "studio") return "/studio";
  return "";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const host = (await headers()).get("host");
  const surface = surfaceForHost(host);
  const next = safeNext(params.next) || inferredNext(surface);

  return <LoginForm next={next} surface={surface ?? "customer"} />;
}
