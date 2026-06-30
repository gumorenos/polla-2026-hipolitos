# La Polla Hipólitos 2026

Webapp privada para gestionar **La Polla Hipólitos 2026**, una competencia entre amigos para el Mundial FIFA 2026.

La aplicación permite administrar competencias, participantes, pronósticos, resultados, rankings, Champion Survivor, cuotas informativas pre-partido y retos referenciales por partido.

> [!IMPORTANT]
> Esta app es privada y self-hosted. No es una plataforma pública de apuestas, no procesa pagos, no custodia fondos, no cobra comisión y no realiza liquidaciones automáticas de dinero.

---

## Estado del proyecto

Proyecto en desarrollo activo para producción privada en Raspberry Pi 5.

Actualmente soporta tres tipos de competencia:

| Tipo interno | Nombre UI | Descripción |
|---|---|---|
| `full_prediction` | Polla completa | Pronósticos de marcadores por partido, puntaje y ranking |
| `champion_survivor` | Champion Survivor | Cada participante elige campeón; se sigue supervivencia, EV y eliminación |
| `match_pool` | Retos por Partido | Bolsa referencial entre amigos por cada partido |

---

## Funcionalidades principales

### Competencias y usuarios

- Registro/login con Better Auth.
- Flujo de aprobación de usuarios.
- Competencias privadas por código de invitación.
- Roles por competencia: `owner`, `admin`, `member`.
- Participación separada del rol mediante `isParticipant`.
- Owner/admin puede ser participante si `isParticipant = true`.

### Polla completa

- Fixture del Mundial 2026.
- Pronósticos antes del kickoff.
- Bloqueo server-side al iniciar el partido.
- Cálculo de puntos por marcador exacto, tendencia, empate y consolación.
- Rankings por bloque y global.
- Panel admin para resultados y recalculo.

### Champion Survivor

- Pick explícito de campeón.
- Deadline configurable por competencia.
- Correcciones admin con razón.
- Equipos eliminados visibles pero atenuados.
- Sincronización de estados del torneo.
- EV estimado usando probabilidad de campeón y concentración de picks.
- Soporte de cuotas de campeón mediante `ChampionOddsSnapshot`.

### Retos por Partido

`match_pool` permite crear retos referenciales por partido:

- El primer usuario crea el reto y define el monto referencial común.
- El creador también registra su predicción.
- Otros participantes solo registran predicción; el monto queda fijo.
- Se puede invitar a usuarios específicos.
- Invitados y vista pública ven información read-only.
- Si solo participa una persona, el reto se anula.
- La liquidación es referencial y se coordina fuera de la app.

Predicciones permitidas:

| Fase | Picks |
|---|---|
| Grupos | `home_win`, `draw`, `away_win` |
| Eliminatorias | `home_advances`, `away_advances` |

Reglas de liquidación referencial:

```text
totalPool      = entries.length * amount
grossPerWinner = floor(totalPool / winners.length)
remainder      = totalPool mod winners.length

winner net     = grossPerWinner - amount
loser net      = -amount
```

El redondeo es determinístico: el remanente va al primer ganador según el orden de entradas.

> [!CAUTION]
> Los montos son solo referenciales. La app no tiene wallet, depósitos, retiros, pagos automáticos, rake, comisión ni integración con procesadores de pago.

---

## Stack técnico

- Next.js 16
- React 19
- TypeScript
- App Router
- Server Actions
- Prisma ORM 6.x
- SQLite
- Better Auth
- Tailwind CSS 4
- Vitest
- PM2
- Cloudflare Tunnel
- Node.js 22

---

## Estructura del repositorio

```text
polla-2026-hipolitos/
├── app/                          # Aplicación Next.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── public/
│   ├── scripts/
│   ├── src/
│   │   ├── app/                  # App Router
│   │   ├── components/
│   │   └── lib/
│   │       ├── actions/          # Server Actions
│   │       ├── services/         # Servicios server-side
│   │       ├── scoring/
│   │       └── match-pool.ts
│   ├── package.json
│   └── next.config.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── MATCH_POOLS.md
│   └── ROADMAP.md
├── AGENTS.md
├── .env.example
└── README.md
```

---

## Requisitos

- Node.js 22
- npm
- SQLite
- Git

Para producción:

- Raspberry Pi 5
- PM2
- Cloudflare Tunnel
- Base de datos SQLite fuera del repo
- Backups periódicos de la DB

---

## Variables de entorno

Usa `.env.example` como plantilla.

Variables mínimas:

```env
DATABASE_URL="file:./prisma/dev.db?connection_limit=1&socket_timeout=20"
BETTER_AUTH_SECRET="your-32-byte-hex-secret-goes-here"
APP_URL="http://localhost:3030"
BETTER_AUTH_URL="http://localhost:3030"
NEXT_PUBLIC_APP_URL="http://localhost:3030"
```

Variables opcionales:

```env
ODDS_DISPLAY_ENABLED=false
ODDS_PRIMARY_PROVIDER=odds-api-io
ODDS_FALLBACK_PROVIDER=the-odds-api
API_FOOTBALL_ENABLED=false
API_FOOTBALL_KEY=""
REMINDERS_ENABLED=false
EMAIL_REMINDERS_ENABLED=false
RESEND_API_KEY=""
```

> [!WARNING]
> Nunca commitear `.env`, `.env.local`, secretos, bases SQLite, archivos WAL/SHM ni `app/package-lock.json`.

---

## Desarrollo local

Desde la raíz del repo:

```bash
cd app
npm install
```

Configura variables de entorno:

```bash
cp ../.env.example .env.local
```

En Windows PowerShell:

```powershell
Copy-Item ..\.env.example .env.local
```

Luego ajusta `DATABASE_URL` para desarrollo local:

```env
DATABASE_URL="file:./prisma/dev.db?connection_limit=1&socket_timeout=20"
APP_URL="http://localhost:3030"
BETTER_AUTH_URL="http://localhost:3030"
NEXT_PUBLIC_APP_URL="http://localhost:3030"
```

Generar cliente Prisma:

```bash
npx prisma generate
```

Crear/aplicar migraciones en entorno local:

```bash
npx prisma migrate dev
```

Cargar seed, si corresponde:

```bash
npx prisma db seed
```

Levantar la app:

```bash
npm run dev
```

---

## Scripts disponibles

Desde `app/`:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run typecheck
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
```

Scripts operativos adicionales:

```bash
npm run odds:refresh-upcoming
npm run odds:refresh-match
npm run h2h:fetch-missing
npm run h2h:fetch-match
npm run results:fetch-due
npm run results:fetch-surgical
npm run results:fetch-match
npm run reminders:send-due
```

---

## Validación antes de desplegar

Desde `app/`:

```bash
./node_modules/.bin/prisma validate
./node_modules/.bin/prisma generate
npm run lint
npm test
npm run build
```

No reiniciar PM2 ni aplicar migraciones en producción si alguno de estos pasos falla.

---

## Despliegue en Raspberry Pi

> [!IMPORTANT]
> Codex/Antigravity trabajan en Windows y hacen commit/push.
> Producción se despliega manualmente en Raspberry Pi.
> Nunca tocar producción desde Codex/Antigravity.

Flujo recomendado en Raspberry:

```bash
cd /home/gumorenos/apps/polla-2026-hipolitos

git fetch origin
git log --oneline HEAD..origin/main
git reset --hard origin/main

cd app

rm -f package-lock.json

npm install --no-audit --no-fund

./node_modules/.bin/prisma validate
./node_modules/.bin/prisma generate

npm run lint
npm test
npm run build
```

Si todo pasa:

```bash
./node_modules/.bin/prisma migrate deploy

pm2 restart polla-2026-hipolitos --update-env
pm2 save
```

Verificación básica:

```bash
curl "$APP_URL/api/health"
```

---

## Producción

Configuración esperada:

```env
DATABASE_URL="file:/var/lib/la-polla-2026/prod.db?connection_limit=1&socket_timeout=20"
APP_URL="<production-url>"
BETTER_AUTH_URL="<production-url>"
NEXT_PUBLIC_APP_URL="<production-url>"
PORT=3030
NODE_ENV=production
```

La base de datos de producción debe vivir fuera del repo:

```text
/var/lib/la-polla-2026/prod.db
```

---

## Jobs y automatización

Cron histórico para recordatorios:

```cron
*/5 * * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run reminders:send-due >> /home/gumorenos/logs/reminders.log 2>&1
```

Fetcher de resultados tradicional:

```cron
*/15 * * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run results:fetch-due >> /home/gumorenos/logs/results.log 2>&1
```

Fetcher quirúrgico recomendado tras validación:

```cron
*/5 * * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run results:fetch-surgical >> /home/gumorenos/logs/results-surgical.log 2>&1
```

No cambiar el cron de producción hasta validar el surgical fetch completo.

---

## Cuotas y proveedores

La app puede guardar cuotas informativas:

- `OddsSnapshot`: cuotas por partido.
- `ChampionOddsSnapshot`: cuotas de campeón.
- `ProviderCredential`: credenciales cifradas de proveedores.
- `ProviderStatus`: cooldowns/estado de proveedores.
- `TeamAlias` y `ProviderTeamOutcome`: normalización de equipos/proveedores.

Reglas:

- Mostrar solo cuotas pre-partido congeladas durante partidos en curso.
- No decir “odds en vivo”.
- No refrescar cuotas después del kickoff.
- Para `match_pool`, `showOdds` debe estar apagado por defecto.

---

## Resultados y bracket

La app maneja:

- Fixture completo de 104 partidos:
  - 72 fase de grupos
  - 16 Round of 32
  - 8 Round of 16
  - 4 cuartos
  - 2 semifinales
  - tercer puesto
  - final
- Annex C FIFA para resolver mejores terceros en Round of 32.
- Propagación de ganadores en eliminatorias.
- Sincronización de Champion Survivor tras resultados finales.
- Guardado manual cuando proveedores devuelven datos inconsistentes.

Los resultados finales deben pasar por el pipeline que recalcula standings, propaga bracket y sincroniza estados.

---

## Reglas para agentes

Ver `AGENTS.md` para instrucciones completas.

Reglas críticas:

- No usar Supabase.
- No usar Auth.js/NextAuth.
- Usar SQLite + Prisma.
- Usar Better Auth.
- No tocar producción desde Windows.
- No commitear secretos ni DB.
- No modificar migraciones antiguas.
- Si hay schema nuevo, crear migración aditiva.
- Archivos con `'use server'` deben exportar solo funciones async.
- Documentar decisiones relevantes en `docs/DECISIONS.md`.

---

## Seguridad

- Sesiones con cookies HttpOnly.
- Acciones sensibles protegidas server-side.
- Bloqueo de pronósticos validado en servidor.
- SQLite fuera del webroot en producción.
- Secretos por variables de entorno.
- No exponer credenciales de proveedores al cliente.
- No procesar dinero real.

---

## Documentación relacionada

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`
- `docs/MATCH_POOLS.md`
- `AGENTS.md`

---

## Licencia / uso

Proyecto privado para uso personal/familiar/amigos.

No está diseñado como SaaS público ni como plataforma de apuestas.
