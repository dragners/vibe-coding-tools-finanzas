# --- Builder: compila planvsfondo y comparadorhipotecas ---
FROM node:20-alpine AS builder
WORKDIR /build

# Instala deps por app (mejor caché)
COPY apps/planvsfondo/package.json apps/planvsfondo/package-lock.json* ./apps/planvsfondo/
COPY apps/comparadorhipotecas/package.json apps/comparadorhipotecas/package-lock.json* ./apps/comparadorhipotecas/
RUN --mount=type=cache,target=/root/.npm \
    (cd apps/planvsfondo && npm ci) && \
    (cd apps/comparadorhipotecas && npm ci)

# Copia fuentes y build
COPY apps/planvsfondo/ ./apps/planvsfondo/
COPY apps/comparadorhipotecas/ ./apps/comparadorhipotecas/
RUN --mount=type=cache,target=/root/.npm \
    (cd apps/planvsfondo && npm run build) && \
    (cd apps/comparadorhipotecas && npm run build)

# --- Runtime: Nginx sirviendo landing + apps ---
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Landing en la raíz
COPY landing/ /usr/share/nginx/html/

# Copia los dist de cada app a su subcarpeta
COPY --from=builder /build/apps/planvsfondo/dist/ /usr/share/nginx/html/planvsfondo/
COPY --from=builder /build/apps/comparadorhipotecas/dist/ /usr/share/nginx/html/comparadorhipotecas/

RUN chmod -R 755 /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

