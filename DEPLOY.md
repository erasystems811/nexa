# Deploying Nexa

Nexa is a monorepo — `api-server` (Fastify, port 4000) plus three frontends:
`apps/customer` (Next.js), `apps/admin` and `apps/studio` (Vite SPAs, served by
`serve` on port 3000). All four ship as Docker containers via the root
`docker-compose.yml`. Self-hosted Supabase (Postgres/Auth/Storage) runs
alongside them on the same box.

**Host: a Hetzner VPS (`167.233.242.179`)**, shared with Bali and self-hosted
Supabase. There is no Railway or Vercel deploy anymore — Nexa moved off
Railway on 2026-08-16/17. If you find old Railway services still running,
they're a rollback window, not the live path — confirm with the owner before
assuming otherwise or deleting them.

## Layout on the box

```
/opt/nexa              # this repo, its own `git clone` (not shared with /opt/bali)
/opt/nexa/.env          # one shared env file, referenced by every service's env_file
/opt/nexa/docker-compose.yml
```

`docker-compose.yml` defines four services: `customer`, `admin`, `vendor`,
`api-server`. Note the service (and container / DNS) name for the vendor app
is `vendor`, even though its source directory is `apps/studio` — Caddy and
`API_BASE_URL` references use `vendor`, not `studio`.

All four join one compose-project network (`nexa_default`). `customer` talks
to `api-server` over that internal Docker network
(`API_BASE_URL=http://api-server:4000`) — it never round-trips through the
public internet.

## Routing / domains

A single shared Caddy instance (`bali-caddy-1`, the one already fronting every
`erasystems.com.ng` subdomain on this box) was joined to `nexa_default` via
`docker network connect nexa_default bali-caddy-1`, and proxies:

| Domain | → |
| --- | --- |
| `nexa.erasystems.com.ng` | `customer:3000` |
| `admin.nexa.erasystems.com.ng` | `admin:3000` |
| `vendor.nexa.erasystems.com.ng` | `vendor:3000` |
| `api.nexa.erasystems.com.ng` | `api-server:4000` — public HTTPS endpoint admin/studio's *browser-side* calls need |
| `db.nexa.erasystems.com.ng` | self-hosted Supabase's Envoy gateway (`supabase-envoy:8000`) |

`db.nexa.erasystems.com.ng` matters more than it looks: `VITE_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_URL` must point at this HTTPS domain, not the raw
`http://167.233.242.179:8000`. Every app is served over HTTPS, and a browser
silently blocks an HTTPS page's calls to an HTTP origin — this broke sign-in
with no server-side error at all when it was still pointed at the raw IP.

DNS for the app subdomains are **A records** to `167.233.242.179`, not CNAMEs
— a name can't hold both, so switching from a CNAME (the old Railway setup)
requires deleting it first, not just adding an A record alongside it.

## Environment variables

One `.env` at `/opt/nexa/.env`, consumed by every service's `env_file:`.
Covers Supabase, Flutterwave, WhatsApp, Gotenberg, and admin bootstrap
credentials (`NEXA_SUPER_ADMIN_USERNAME` / `_EMAIL` / `_PASSWORD` — see
README's "Admin access"). Get the current values from whoever last deployed,
or from the box itself — never commit them.

**Docker build vs. runtime — this is the sharpest edge here.** `env_file:` /
`environment:` in compose only apply at container *runtime*, not during
`docker build`. `NEXT_PUBLIC_*` and `VITE_*` vars are read *at build time* and
baked into the compiled bundle — a plain `docker compose build` sees none of
`.env`. Both Dockerfiles solve this with a BuildKit secret mount:

```dockerfile
RUN --mount=type=secret,id=envfile,target=/app/.env.build \
    sh -c 'set -a; . /app/.env.build; set +a; npm run build ...'
```

with `docker-compose.yml`'s `secrets: {envfile: {file: .env}}` referenced per
service — real values available during the build, never written into an
image layer.

**Corollary: BuildKit secret mounts aren't part of the build cache key.**
Changing `.env`'s *content* alone does NOT invalidate a cached `RUN
--mount=type=secret` layer — Docker doesn't see anything in the instruction
itself change. If you edit `.env` and only the values baked into a
`NEXT_PUBLIC_*`/`VITE_*` var should change, you must force a rebuild:

```bash
docker compose build --no-cache <service>
```

Verify by curling the actual served JS bundle for the new value — "the build
exited 0" does not mean the new env var made it in.

## Deploy procedure

No CI yet — this is manual:

```bash
ssh root@167.233.242.179 "cd /opt/nexa && git pull && DOCKER_BUILDKIT=1 docker compose build <service> && docker compose up -d"
```

Use `--no-cache` on the build step whenever the change is to `/opt/nexa/.env`
itself rather than repo code (see above). Rebuild just the service(s) that
changed — no need to rebuild all four for a change in one app.

## Node version

Every Dockerfile pins `node:22-alpine`, and `engines.node` is `>=22`
everywhere in the repo. This isn't arbitrary: `@supabase/supabase-js`'s
realtime client needs Node 22+ for native `WebSocket` support — on Node 20 it
throws `"Node.js detected but native WebSocket not found"` on every
authenticated api-server request. This was latent even back on Railway
(Railway's auto-detector happened to pick a newer Node for the same `>=20`
constraint); don't loosen the floor back to 20 without re-checking this.

## After a fresh DB (migration or reseed)

Some settings are *data*, not schema, and don't travel with a migration —
specifically the `feature_flags` table. Toggles flipped on manually via the
Admin Console (e.g. `whatsapp_mediated_chat`, which gates the entire inbound
WhatsApp message-handling path and fails closed if missing/off) won't be on
in a fresh database until someone flips them again:

```bash
docker exec supabase-db psql -U postgres -d postgres \
  -c "update feature_flags set enabled = true where key = 'whatsapp_mediated_chat';"
```

Check `feature_flags` (and any other admin-toggled settings table) after any
reseed for flags the team expects ON that only ever got set via the UI.

## Troubleshooting

Check `docker compose ps` / `docker logs <service>` on the Hetzner box first
— that's the live path now, not Railway.

- **Cert issuance briefly failing right after a DNS cutover** (`http-01: 404`,
  `tls-alpn-01: Cannot negotiate ALPN`) is expected while DNS propagates —
  Let's Encrypt's validators can see stale records from some vantage points
  for a few minutes. Caddy backs off and retries on its own; restarting the
  caddy container forces an immediate retry instead of waiting it out.
- **A `next/font/google` build failing on a fetch to Google Fonts** is
  usually transient — retry the exact same build once before investigating.

## What "live" does and does not mean

- **Works:** every screen, sign-up and login, the three surfaces, the whole
  booking and admin flow — end to end.
- **Real money:** set `PAYMENT_GATEWAY=flutterwave` with
  `FLUTTERWAVE_SECRET_KEY` and `FLUTTERWAVE_WEBHOOK_SECRET`. Nexa is its own
  escrow — customers pay into Nexa's Flutterwave balance, and vendors are
  paid out by Transfer once the customer confirms with their code. Leave it
  on `mock` to click through the flows without moving money.
- **Worth knowing:** holding customers' funds between payment and payout
  carries regulatory weight in Nigeria. That is a business conversation, not
  a code change.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev:api        # api-server on :4000
npm run dev:customer    # or dev:studio / dev:admin
```

See the README for schema migrations (`supabase/migrations/`) and the
`npm run typecheck` / `npm run lint` checks.
