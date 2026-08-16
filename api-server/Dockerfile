# Node 22+ specifically (not just the >=20 engines.node minimum) - @supabase/
# supabase-js's realtime client needs native WebSocket, which lands in 22.
FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm install

ENV PORT=4000
EXPOSE 4000

CMD ["npx", "tsx", "api-server/src/index.ts"]
