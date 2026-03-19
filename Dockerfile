# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve with nginx (non-root)
FROM nginx:alpine AS runner
RUN apk add --no-cache wget
COPY --from=builder /app/dist/jauria-admin/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/cache/nginx /var/run/nginx.pid /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=2 \
  CMD wget -qO- http://127.0.0.1:8080/index.html || exit 1
USER nginx
CMD ["nginx", "-g", "daemon off;"]
