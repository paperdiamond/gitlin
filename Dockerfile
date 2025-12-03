FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy and install dependencies (cached layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy pre-built application from git
COPY dist ./dist

ENV NODE_ENV=production
USER node

CMD ["node", "dist/index.js"]
