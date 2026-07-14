/**
 * Subdomain -> surface routing.
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
  if (!host) return null;
  const h = (host.split(":")[0] ?? host).toLowerCase();
  const firstLabel = h.split(".")[0] ?? "";

  // Keep Admin/Studio reachable even when Railway has not received the exact
  // root-domain env yet. A custom admin host must never fall back to customer.
  if (LABEL_TO_SURFACE[firstLabel]) return LABEL_TO_SURFACE[firstLabel];

  if (!root) return null;
  if (h === root || h === `www.${root}`) return "customer";
  if (!h.endsWith(`.${root}`)) return null;
  const label = h.slice(0, h.length - (`.${root}`).length).split(".").pop() ?? "";
  return LABEL_TO_SURFACE[label] ?? "customer";
}

const AUTH_ROUTES = ["/login", "/register", "/verify", "/reset", "/account"];

/**
 * Routes that mean the same thing on every surface and must never be rewritten
 * into one.
 *
 * /apply is how a business asks to join, and the vendor surface is exactly where
 * somebody who is not a vendor yet lands — rewriting it to /studio/apply would
 * 404 the one page they came for. /vendor-access is what that person is shown.
 */
const PUBLIC_ROUTES = ["/apply", "/vendor-access"];

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

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((p) => path === p || path.startsWith(`${p}/`));
}


export type RouteAction =
  | { kind: "pass" }
  | { kind: "rewrite"; to: string }
  | { kind: "redirect"; surface: Surface; path: string }
  | { kind: "notFound" };

export function resolveRoute(surface: Surface, path: string): RouteAction {
  if (isAsset(path) || isAuthRoute(path) || isPublicRoute(path)) return { kind: "pass" };

  for (const [s, base] of Object.entries(SURFACE_BASE) as [Surface, string][]) {
    if (s === surface || base === "") continue;
    if (path === base || path.startsWith(`${base}/`)) {
      // Business Studio is not reachable from the customer site. A customer who
      // types /studio (or /vendor, which is not a route at all) gets a 404, not a
      // trip to a vendor's dashboard. Vendors use vendor.<root>.
      if (surface === "customer" && s === "studio") return { kind: "notFound" };
      const remainder = path.slice(base.length) || "/";
      return { kind: "redirect", surface: s, path: remainder };
    }
  }

  if (surface === "customer") return { kind: "pass" };

  const base = SURFACE_BASE[surface];
  if (path === base || path.startsWith(`${base}/`)) return { kind: "pass" };


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

/**
 * Undefined, on purpose: the session cookie is host-only, so it belongs to the
 * one subdomain that set it and no other.
 *
 * This used to return `.${root}`, which scoped the cookie to the whole family
 * and made one sign-in span customer, vendor and admin at once. That is exactly
 * the mixing that made the three surfaces feel like one: signing in on Admin
 * carried the Admin session onto the vendor site, where it read as "you are an
 * admin, not a vendor." Three standalone surfaces means three separate sign-ins.
 * Admin stays on admin.<root>, vendor on vendor.<root>, customer on the root —
 * and a session on one is invisible to the others.
 */
export function cookieDomain(): string | undefined {
  return undefined;
}
