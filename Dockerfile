# ===== Build PlanVSFondo =====
FROM node:20-alpine AS build_planvsfondo
WORKDIR /app
COPY apps/planvsfondo/package.json apps/planvsfondo/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY apps/planvsfondo ./
ARG VITE_BASE=/planvsfondo/
ENV VITE_BASE=$VITE_BASE
RUN npm run build

# ===== Build ejemplo =====
FROM node:20-alpine AS build_ejemplo
WORKDIR /app
COPY apps/ejemplo/package.json apps/ejemplo/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY apps/ejemplo ./
ARG VITE_BASE=/ejemplo/
ENV VITE_BASE=$VITE_BASE
RUN npm run build

# ===== Runtime =====
FROM nginx:alpine
COPY landing/ /usr/share/nginx/html/
COPY --from=build_planvsfondo /app/dist /usr/share/nginx/html/planvsfondo
COPY --from=build_ejemplo     /app/dist /usr/share/nginx/html/ejemplo
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
