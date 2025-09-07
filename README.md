# Multi-app (landing raíz y apps en subcarpetas)

- Landing en `/`
- Apps en `/planvsfondo/`, `/ejemplo/`
- Preparado para proxy externo con HTTPS que apunte todo el dominio a este contenedor

## Arranque
docker compose up -d --build
# http://host:8080/
# http://host:8080/planvsfondo/
# http://host:8080/ejemplo/

## Añadir una nueva app (subcarpeta)
1. Copia `apps/ejemplo` a `apps/mi-app` y cambia `"name"` en `package.json`.
2. Mantén `vite.config.ts` con `base: process.env.VITE_BASE || '/'`.
3. Edita `Dockerfile`:
   - Duplicar bloque build
   - `ARG VITE_BASE=/mi-app/` + `ENV VITE_BASE=$VITE_BASE`
   - En runtime: `COPY --from=build_mi_app /app/dist /usr/share/nginx/html/mi-app`
4. Añade enlace en `landing/index.html`
5. `docker compose up -d --build`
