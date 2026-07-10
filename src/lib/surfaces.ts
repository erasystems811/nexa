/**
 * Subdomain → surface routing. PRD Addendum v1.1 §2.
 *
 * Nexa is one app serving four surfaces on four subdomains:
 *
 *   nexa.<root>            -> customer marketplace   (routes at /)
 *   vendor.nexa.<root>     -> Business Studio          (routes under /studio)
 *   rider.nexa.<root>      -> Rider App                (routes under /rider)
 *   admin.nexa.<root>      -> Admin Console            (routes under /admin)
 *
 * This file is pure logic — no request objects, no Next imports — so the
 * hostname → surface → rewrite decision can be unit-tested directly.
 *
 * It only engages when NEXT_PUBLIC_ROOT_DOMAIN is set (the live custom domain).
 * On localhost or the raw Railway URL the root domain does not match, so
 * surfaceForHost returns null and the app stays single-domain / path-based —
 * exactly how it runs in development and on the first Railway deploy.
 */

export type Surface = "customer" | "studio" | "rider" | "admin";

export const SURFACE_BASE: Record<Surface, string> = {
  customer: "",
  studio: "/studio",
  rider: "/rider",
  admin: "/admin",
};

/** subdomain label -> surface. The bare root and www are the customer app. */
const LABEL_TO_SURFACE: Record<string, Surface> = {
  vendor: "studio",
  rider: "rider",
  admin: "admin",
};

/** surface -> subdomain label used to build an absolute URL for that surface. */
export const SURFACE_LABEL: Record<Surface, string | null> = {
  customer: null, // the bare root domain
  studio: "vendor",
  rider: "rider",
  admin: "admin",
};

export function rootDomain(): string | undefined {
  const v = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  return v ? v.toLowerCase().replace(/^\.+/, "") : undefined;
}

/**
 * Which surface does this hostname belong to? Returns null for single-domain /
 * dev mode (localhost, an IP, the Railway URL — anything not under the
 * configured root domain).
 */
export function surfaceForHost(host: string | null | undefined, root = rootDomain()): Surface | null {
  if (!host || !root) return null;
  const h = (host.split(":")[0] ?? host).toLowerCase();
  if (h === root || h === `www.${root}`) return "customer";
  if (!h.endsWith(`.${root}`)) return null;
  const label = h.slice(0, h.length - (`.${root}`).length).split(".").pop() ?? "";
  return LABEL_TO_SURFACE[label] ?? "customer";
}

// Routes that work on every subdomain: auth, the account page, and framework
// assets. Messages are handled per-surface (customer + provider only).
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

/**
 * Given the surface a request arrived on and its path, decide what to serve:
 * pass it through, rewrite it into the surface's internal routes, redirect it
 * to the subdomain it really belongs to, or 404.
 */
export function resolveRoute(surface: Surface, path: string): RouteAction {
  if (isAsset(path) || isAuthRoute(path)) return { kind: "pass" };

  // A path under another surface's base belongs on that surface's subdomain.
  for (const [s, base] of Object.entries(SURFACE_BASE) as [Surface, string][]) {
    if (s === surface || base === "") continue;
    if (path === base || path.startsWith(`${base}/`)) {
      const remainder = path.slice(base.length) || "/";
      return { kind: "redirect", surface: s, path: remainder };
    }
  }

  if (surface === "customer") {
    // Everything left is a customer route (/, /search, /l, /p, /book, /orders,
    // /messages, …). Other surfaces were already peeled off above.
    return { kind: "pass" };
  }

  const base = SURFACE_BASE[surface];

  // Already addressed with the surface prefix (the app's own internal links).
  if (path === base || path.startsWith(`${base}/`)) return { kind: "pass" };

  if (path.startsWith("/messages")) {
    return messagesAllowed(surface) ? { kind: "pass" } : { kind: "notFound" };
  }

  // The bare subdomain root shows the surface home; a clean path is prefixed.
  if (path === "/") return { kind: "rewrite", to: base };
  return { kind: "rewrite", to: `${base}${path}` };
}

/** The absolute origin for a surface, e.g. https://vendor.nexa.example. */
export function surfaceOrigin(surface: Surface, root = rootDomain()): string | null {
  if (!root) return null;
  const label = SURFACE_LABEL[surface];
  const host = label ? `${label}.${root}` : root;
  return `https://${host}`;
}

/** Where a signed-in role belongs. Absolute (subdomain) in live mode, path in dev. */
export function homeForRole(role: "admin" | "provider" | "customer" | "rider"): string {
  const surface: Surface =
    role === "provider" ? "studio" : role === "rider" ? "rider" : role === "admin" ? "admin" : "customer";
  const origin = surfaceOrigin(surface);
  if (origin) return `${origin}/`;
  // Dev / single-domain: fall back to the internal path.
  return SURFACE_BASE[surface] || "/";
}

/** The cookie domain that lets the session span all subdomains, or undefined in dev. */
export function cookieDomain(): string | undefined {
  const root = rootDomain();
  return root ? `.${root}` : undefined;
}
