FROM node:20-alpine
WORKDIR /app
COPY services/listadofondos-api/src ./src
COPY services/listadofondos-api/package.json ./
COPY apps/listadofondos/config ./config
RUN mkdir -p /app/cache
ENV NODE_ENV=production
ENV CONFIG_PATH=/app/config/fondos.yaml
ENV CACHE_DIR=/app/cache
EXPOSE 3000
CMD ["node", "src/server.js"]
