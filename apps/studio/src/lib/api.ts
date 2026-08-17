import { supabase } from "./supabase";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // body wasn't JSON — keep the status text.
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function withQuery(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const res = await fetch(withQuery(path, params), { headers: await authHeader() });
  return handle<T>(res);
}

export async function apiSend<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const headers = await authHeader();
  // Fastify's JSON body parser rejects a request that carries a
  // Content-Type: application/json header but zero bytes of body -
  // "Body cannot be empty when content-type is set to 'application/json'".
  // Every bodyless action was hitting exactly this.
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(new URL(path, BASE_URL), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

/** Multipart upload — file plus optional extra form fields. */
export async function apiUpload<T>(path: string, file: File, fields?: Record<string, string>): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  if (fields) {
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
  }
  const res = await fetch(new URL(path, BASE_URL), {
    method: "POST",
    headers: await authHeader(),
    body: form,
  });
  return handle<T>(res);
}
