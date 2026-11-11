# Imagen de produccion de la API.
# Dos etapas: la primera instala todo y compila TypeScript; la segunda lleva
# solo el codigo compilado y las dependencias de produccion. Asi la imagen
# final no trae compilador, pruebas ni herramientas de desarrollo.

FROM node:24-slim AS construccion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=construccion --chown=node:node /app/package.json ./
COPY --from=construccion --chown=node:node /app/node_modules ./node_modules
COPY --from=construccion --chown=node:node /app/dist ./dist

# Sin privilegios de administrador dentro del contenedor.
USER node
EXPOSE 3000

# Docker marca el contenedor como sano solo si la API y sus dos bases responden.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "dist/main.js"]
