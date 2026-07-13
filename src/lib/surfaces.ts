/**
 * Subdomain -> surface routing. PRD Addendum v1.2.
 *
 * Nexa is one app serving three primary surfaces on subdomains:
 *
 *   nexa.<root>            -> customer marketplace   (routes at /)
 *   vendor.nexa.<root>     -> Business Studio        (routes under /studio)
 *   admin.nexa.<root>      -> Admin Console          (routes under /admin)
 *
 * The old rider subdomain is intentionally not a surface anymore. Transport and
 * logistics companies are providers, not a Nexa-operated rider pool.
 */

export type Surface = "customer" | "studio" | "admin";

export const SURFACE_BASE: Record<Surface, string> = {
  customer: "",
  studio: "/studio",
  admin: "/admin",
};

/** subdomain label -> surface. The bare root and www are the customer app. */
const LABEL_TO_SURFACE: Record<string, Surface> = {
  vendor: "studio",
  admin: "admin",
};

/** surface -> subdomain label used to build an absolute URL for that surface. */
export const SURFACE_LABEL: Record<Surface, string | null> = {
  customer: null,
  studio: "vendor",
  admin: "admin",
};

export function rootDomain(): string | undefined {
  const v = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  return v ? v.toLowerCase().replace(/^\.+/, "") : undefined;
}

export function surfaceForHost(host: string | null | undefined, root = rootDomain()): Surface | null {
  if (!host || !root) return null;
  const h = (host.split(":")[0] ?? host).toLowerCase();
  if (h === root || h === `www.${root}`) return "customer";
  if (!h.endsWith(`.${root}`)) return null;
  const label = h.slice(0, h.length - (`.${root}`).length).split(".").pop() ?? "";
  return LABEL_TO_SURFACE[label] ?? "customer";
}

const AUTH_ROUTES = ["/login", "/register", "/account"];

function isAsset(path: string): boolean {
  return (
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path === "/favicon.ico" ||
    /\.[a-z0-9]+$/i.test(path)
  );
}

function isAuthRoute(path: string): boolean {
  return AUTH_ROUTES.some((p) => path === p || path.startsWith(`${p}/`));
}

function messagesAllowed(surface: Surface): boolean {
  return surface === "customer" || surface === "studio";
}

export type RouteAction =
  | { kind: "pass" }
  | { kind: "rewrite"; to: string }
  | { kind: "redirect"; surface: Surface; path: string }
  | { kind: "notFound" };

export function resolveRoute(surface: Surface, path: string): RouteAction {
  if (isAsset(path) || isAuthRoute(path)) return { kind: "pass" };

  for (const [s, base] of Object.entries(SURFACE_BASE) as [Surface, string][]) {
    if (s === surface || base === "") continue;
    if (path === base || path.startsWith(`${base}/`)) {
      const remainder = path.slice(base.length) || "/";
      return { kind: "redirect", surface: s, path: remainder };
    }
  }

  if (surface === "customer") return { kind: "pass" };

  const base = SURFACE_BASE[surface];
  if (path === base || path.startsWith(`${base}/`)) return { kind: "pass" };

  if (path.startsWith("/messages")) {
    return messagesAllowed(surface) ? { kind: "pass" } : { kind: "notFound" };
  }

  if (path === "/") return { kind: "rewrite", to: base };
  return { kind: "rewrite", to: `${base}${path}` };
}

export function surfaceOrigin(surface: Surface, root = rootDomain()): string | null {
  if (!root) return null;
  const label = SURFACE_LABEL[surface];
  const host = label ? `${label}.${root}` : root;
  return `https://${host}`;
}

export function homeForRole(role: "admin" | "provider" | "customer" | "rider"): string {
  const surface: Surface = role === "provider" ? "studio" : role === "admin" ? "admin" : "customer";
  const origin = surfaceOrigin(surface);
  if (origin) return `${origin}/`;
  return SURFACE_BASE[surface] || "/";
}

export function cookieDomain(): string | undefined {
  const root = rootDomain();
  return root ? `.${root}` : undefined;
}