# Deploying Nexa

Nexa is a Next.js app backed by Supabase. The database is already live and
migrated (project `nsaashgvpwtxrjtknimr`); deploying means putting the web app
on the internet and pointing it at that database.

**Host: Railway** — consistent with the other ERA apps. The repo already carries
the config Railway needs (`railway.json`, `.nvmrc`), so it builds without extra
setup. (Vercel is also a fine option and needs even less config; its steps are
kept at the bottom of this file.)

## Deploy on Railway

1. Go to <https://railway.app> and sign in with the **GitHub** account that owns
   `erasystems811/nexa`.
2. **New Project → Deploy from GitHub repo → nexa.** Railway reads `railway.json`
   and builds with Nixpacks automatically (Node 20, `npm run build`, then
   `next start` on Railway's port).
3. Open the service → **Variables** and add these, then let it redeploy:

   | Name | Value | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://nsaashgvpwtxrjtknimr.supabase.co` | safe to expose |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(Supabase → Settings → API → anon public)* | safe to expose |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(Supabase → Settings → API → service_role)* | **secret** |
   | `PAYMENT_GATEWAY` | `mock` | real money stays off until Flutterwave is confirmed |
   | `TELEPHONY_PROVIDER` | `mock` | masked calling stays off until a provider is wired |

   The keys are also in your local `nexa/.env.local` if that is easier to copy
   from. Never paste the `service_role` key anywhere public.

   > These must be set **before** the build finishes — the build reads the
   > `NEXT_PUBLIC_*` values. If the first build ran without them, just add them
   > and hit **Redeploy**.

4. **Settings → Networking → Generate Domain.** Railway gives you a public URL
   like `https://nexa-production.up.railway.app`. That is your live app.
5. Add one more variable, `NEXT_PUBLIC_SITE_URL`, set to that URL, and redeploy
   once more so sign-in links point at the right place.
6. Tell Supabase the address: Supabase → **Auth → URL Configuration** → set
   **Site URL** to the Railway URL and add it under **Redirect URLs**. (Claude
   can do this for you via the Supabase API — just share the URL.)

## Deploy on Vercel (alternative)

1. Go to <https://vercel.com> and sign up with the **GitHub** account that owns
   `erasystems811/nexa`.
2. Click **Add New… → Project**, and **Import** the `nexa` repository.
3. Vercel detects Next.js automatically — leave the build settings alone.
4. Before clicking Deploy, open **Environment Variables** and add these:

   | Name | Value | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://nsaashgvpwtxrjtknimr.supabase.co` | safe to expose |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(from Supabase → Settings → API → anon public)* | safe to expose |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(from Supabase → Settings → API → service_role)* | **secret** |
   | `PAYMENT_GATEWAY` | `mock` | real money stays off until Flutterwave is confirmed |
   | `TELEPHONY_PROVIDER` | `mock` | masked calling stays off until a provider is wired |
   | `NEXT_PUBLIC_SITE_URL` | *(fill in after the first deploy — the Vercel URL)* | |

   The two keys are already in your local `nexa/.env.local` file if it is easier
   to copy them from there. Never paste the `service_role` key anywhere public.

5. Click **Deploy**. After a minute or two you get a URL like
   `https://nexa-xxxx.vercel.app`.

## After the first deploy

1. Copy the Vercel URL. Set `NEXT_PUBLIC_SITE_URL` to it (Vercel → Settings →
   Environment Variables), then **Redeploy** once so the app picks it up.
2. Tell Supabase the app's address so sign-in links work: Supabase → **Auth →
   URL Configuration** → set **Site URL** to the Vercel URL and add it under
   **Redirect URLs**. (Claude can do this for you via the Supabase API.)

## The four subdomains (Addendum §2)

The app is built to serve each surface on its own subdomain, and this switches
on the moment you set one variable — until then it stays single-domain on the
Railway URL, which is why Step 1 works before any DNS.

| Subdomain | Shows |
| --- | --- |
| `nexa.erasystems.com.ng` | Customer Marketplace |
| `vendor.nexa.erasystems.com.ng` | Business Studio |
| `rider.nexa.erasystems.com.ng` | Rider App |
| `admin.nexa.erasystems.com.ng` | Admin Console |

To turn it on:

1. **DNS** — at wherever `erasystems.com.ng` is managed, add four CNAME records
   (`nexa`, `vendor.nexa`, `rider.nexa`, `admin.nexa`) pointing at your Railway
   service's domain. In Railway, add each of the four under **Settings →
   Networking → Custom Domain**; Railway shows the exact CNAME target to use.
2. **One variable** — set `NEXT_PUBLIC_ROOT_DOMAIN` = `nexa.erasystems.com.ng`
   in Railway, and `NEXT_PUBLIC_SITE_URL` = `https://nexa.erasystems.com.ng`.
   Redeploy.
3. **Supabase** — set the Site URL to `https://nexa.erasystems.com.ng` and add
   all four subdomains under Redirect URLs. (Claude can do this via the API.)

That's it — each subdomain then shows only its own app, cross-links between them
redirect to the right place, and your login carries across all four (the session
cookie is scoped to the parent domain). Leave `NEXT_PUBLIC_ROOT_DOMAIN` unset and
everything stays reachable by path on the single Railway URL, which is the right
way to test first.

## What "live" does and does not mean

- **Works:** every screen, sign-up and login, the four role apps, the whole
  booking and admin flow — end to end, with test money.
- **Not real money yet:** `PAYMENT_GATEWAY=mock`. Section 20 of the PRD requires
  Flutterwave's escrow product and the Nigerian rules on holding customer funds
  to be confirmed before a single real naira moves. That is a business/legal
  step, not a code change — the code already routes through a swappable
  interface, so switching to Flutterwave later is one adapter and one env var.
- **Empty on purpose:** no cities, categories, or providers. Create the first
  ones from the Admin Console the day you onboard the first real vendor.
