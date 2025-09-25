# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps (better caching)
COPY package*.json ./
# If you use pnpm or yarn, swap the install command accordingly
RUN npm ci

# Copy source and build
COPY . .
# Ensures Astro builds a static site to ./dist (default)
RUN npm run build

# ---- Runtime stage (Nginx) ----
FROM nginx:alpine AS runtime
# Optional: custom Nginx config for SPA-style fallback; see below
COPY ./.docker/nginx.conf /etc/nginx/conf.d/default.conf
# Copy built site
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
