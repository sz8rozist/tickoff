# A Tickoff Next.js alkalmazás (felület + API + widget). A build környezete a repó gyökere:
#   docker build -f web/Dockerfile -t tickoff-app .

# --- widget: a beágyazható script lefordítása (Vite, IIFE) ---
FROM node:22-slim AS widget
WORKDIR /app
COPY package.json package-lock.json ./
COPY widget/package.json widget/
RUN npm ci
COPY widget widget
RUN npm run build -w widget

# --- build: az alkalmazás és az adatbázis-migráció csomagolása ---
FROM node:22-slim AS build
WORKDIR /app/web
ENV NEXT_TELEMETRY_DISABLED=1
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
COPY --from=widget /app/widget/dist/tickoff-widget.js public/widget/tickoff-widget.js
RUN npm run build && npm run build:migrate

# --- run ---
FROM node:22-slim AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 TICKOFF_STORAGE_DIR=/data/screenshots
WORKDIR /app
# Nem root felhasználó; a feltöltött képek helye (Dockerben kötet) az övé
RUN groupadd -g 10001 app && useradd -u 10001 -g app -m app \
    && mkdir -p /data/screenshots && chown -R app:app /data
COPY --from=build --chown=app:app /app/web/.next/standalone ./
COPY --from=build --chown=app:app /app/web/.next/static ./.next/static
COPY --from=build --chown=app:app /app/web/public ./public
COPY --from=build --chown=app:app /app/web/drizzle ./drizzle
COPY --from=build --chown=app:app /app/web/dist-migrate/migrate.cjs ./migrate.cjs
# Egyszeri átvitel a régi (Java) változat adatbázisából: node import.cjs (lásd a README átállási szakaszát)
COPY --from=build --chown=app:app /app/web/dist-migrate/import.cjs ./import.cjs
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Indításkor előbb a függő adatbázis-migrációk futnak le, aztán a szerver indul
CMD ["sh", "-c", "node migrate.cjs && node server.js"]
