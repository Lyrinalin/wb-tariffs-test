FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json knexfile.js ./
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY seeds/ ./seeds/

EXPOSE 3000

CMD ["sh", "-c", "npx knex migrate:latest && node src/index.js"]
