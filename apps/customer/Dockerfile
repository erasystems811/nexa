# Node 22+ specifically (not just the >=20 engines.node minimum) - @supabase/
# supabase-js's realtime client needs native WebSocket, which lands in 22.
FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm install

# Next.js's build step evaluates every route module (incl. env.ts's
# fail-fast zod parse) while collecting page data, so it needs the real
# env vars present at build time, not just at container runtime. Mounted
# as a build secret so the values never land in an image layer.
RUN --mount=type=secret,id=envfile,target=/app/.env.build \
    sh -c 'set -a; . /app/.env.build; set +a; npm run build --workspace apps/customer'

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "apps/customer", "--", "-p", "3000"]
