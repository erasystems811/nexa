FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install

ENV PORT=4000
EXPOSE 4000

CMD ["npx", "tsx", "api-server/src/index.ts"]
