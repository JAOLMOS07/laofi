# La Ofi

Oficina virtual isométrica para las células de desarrollo y QA. El documento maestro del proyecto es [`CLAUDE.md`](./CLAUDE.md).

**Estado: Fase 1 completa y Fase 2 sin integraciones externas** (entregas a QA, muelle, tablero del Lobby y agenda; lo que depende de TI está visible como demo en el panel **Integraciones**).

**Fase 1:** Login, un piso por célula (Axis, Hextech, Atlas y QA) más el Lobby con las oficinas de John y Donovan, oficinas personales que cada quien decora, toc toc con respuestas, post-its, salas con su link fijo de Teams, Sala libre para reuniones planeadas, walkie-talkie, voz opcional con LiveKit, directorio, mapa del edificio y panel de administración.

## Requisitos

- Node.js 22 o superior
- pnpm 10 (viene con Node: ejecuta `corepack enable` una vez)
- PostgreSQL 16 o 17. Lo más simple es con Docker Desktop: `docker compose up -d postgres`

## Correr en local

```bash
corepack enable
pnpm install
cp .env.example .env                          # en PowerShell: Copy-Item .env.example .env
docker compose up -d postgres                 # o usa tu propio Postgres y ajusta DATABASE_URL
pnpm --filter @laofi/server db:deploy         # crea las tablas
pnpm --filter @laofi/server db:seed           # carga el equipo de ejemplo (borra lo que haya)
pnpm dev
```

Abre http://localhost:5173 y entra con cualquiera de estas cuentas. La contraseña de todas es `laofi123`.

| Cuenta                                                         | Quién                                          |
| -------------------------------------------------------------- | ---------------------------------------------- |
| `jhoger@laofi.local`                                           | Jhoger, célula Axis, **administrador**         |
| `john@laofi.local`                                             | John, jefe de desarrollo (oficina en el Lobby) |
| `donovan@laofi.local`                                          | Donovan, gerente de tecnologías (Lobby)        |
| `laura@laofi.local`, `andres@…`, `camila@…`                    | Axis                                           |
| `santiago@…`, `valentina@…`, `mateo@…`                         | Hextech                                        |
| `isabella@…`, `sebastian@…`, `mariana@…`, `tomas@…`, `lucia@…` | Atlas                                          |
| `daniela@…`, `felipe@…`, `sara@…`, `juanpablo@…`               | QA                                             |

Los nombres de las células y de Jhoger, John y Donovan son reales; el resto son de ejemplo. Desde el panel **Admin** puedes cambiar nombres, mover gente de célula (su oficina se muda sola), crear cuentas y pegar los links de Teams.

Para ver el multijugador, abre otra ventana en modo incógnito (o otro navegador) y entra con otra cuenta.

### Qué se puede hacer

- **Caminar**: clic en el piso. `Q` y `E` giran la cámara, la rueda hace zoom.
- **Ascensor**: el botón del dock o pararte sobre el ascensor. Los pisos cerrados por el admin solo dejan entrar a su célula.
- **Toc toc**: clic en alguien o en su tapete, o desde el Directorio. Caminas hasta su puerta (cambiando de piso si hace falta) y le llega el aviso con “Pasa”, “Dame 10 min” o “Ahora no”. Si está en foco o ausente, su puerta se cierra y el toque queda en cola.
- **Post-its**: desde la ficha de la persona. Se ven sobre su escritorio y en su bandeja (Notas). Se borran a los 30 días.
- **Salas**: al entrar aparece la tarjeta con “Hablar aquí” (voz en la app) y “Abrir en Teams” (el link fijo de la reunión). En la **Sala libre** del Lobby cualquiera pega el link de una reunión planeada.
- **Walkie-talkie**: mantén `Espacio` o el botón Walkie. Le hablas a la sala donde estás, o a todo el piso, o a una persona si la eliges desde su ficha.
- **Mi oficina**: catálogo de muebles, rotar (`R`), mover, recolorear, quitar, y colores de pared y piso. Solo tú editas la tuya; los demás ven los cambios en vivo.
- **Mi avatar**: piel, peinado, ropa y accesorios.
- **En qué estás**: el botón junto a tu estado publica tu HU (“Desarrollando HU-1302”) sobre tu oficina. Si pegas el link del work item, el clic lleva a Azure DevOps. Desde ahí mismo la entregas a QA o la quitas. Nada se detecta solo.
- **Entregas y despliegues**: registras una entrega y su caja viaja al muelle del piso de QA. QA la toma en pruebas, la aprueba o la devuelve con el motivo. Lo que vuelve aparece junto al ascensor de la célula: en rojo para arreglar y reenviar, en verde para desplegar. Al desplegar, un trencito cruza el piso. El tablero del Lobby lo resume.
- **Agenda**: agregas una reunión con hora, sala y link de Teams opcional. Un minuto antes llega “Tu reunión empieza: ¿vamos?”, te lleva a la sala y al terminar te ofrece volver a tu oficina. “Probar el aviso ahora” lo muestra de inmediato.
- **Integraciones**: qué funciona hoy, qué es demo y qué necesita a TI. Un admin puede simular entregas de Azure DevOps, cargar ejemplos y quitarlos.

### Voz (opcional)

Sin LiveKit la app funciona igual: el walkie muestra quién habla y las salas ofrecen Teams. Para probar el audio:

```bash
docker compose --profile voz up -d livekit
```

y en `.env` descomenta `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET`. El navegador pedirá permiso de micrófono la primera vez.

## Si actualizas el código

Cuando cambien las tablas, aplica las migraciones. No borra datos:

```bash
pnpm --filter @laofi/server db:deploy
```

## Mostrárselo al equipo desde tu máquina

1. Averigua la IP de tu máquina en la red (por ejemplo `192.168.1.20`).
2. En `.env`, pon `VITE_SERVER_URL=ws://192.168.1.20:2567` y reinicia `pnpm dev`.
3. Comparte `http://192.168.1.20:5173`. Windows puede pedir permitir los puertos 5173 y 2567 en el firewall.

Para alguien fuera de tu red hace falta un túnel (por ejemplo Cloudflare Tunnel, gratis) hacia los puertos 5173 y 2567; eso queda para cuando lo necesites.

## Publicar en Render + Neon

Producción usa un solo puerto: el mismo servidor entrega la API, el cliente y el multijugador. La base es Neon y el servicio se define en [`render.yaml`](./render.yaml). La voz queda apagada hasta configurar LiveKit (ver abajo).

1. Crea un proyecto en Neon y guarda su cadena de conexión **directa** (no la pooled) solo en tu máquina.
2. Prepara la base una sola vez, desde tu PC. El seed de producción nunca borra: si la base ya tiene usuarios, se niega. Lee las cuentas de `equipo.local.json`, ignorado por git: una lista de `{ "email", "name", "cell", "title"?, "admin"?, "lobby"? }`.

   ```powershell
   $env:DATABASE_URL = '<cadena de Neon>'
   pnpm --filter @laofi/server exec prisma migrate deploy
   pnpm --filter @laofi/server db:seed:prod
   ```

   Las contraseñas temporales quedan en `credenciales-temporales.local.txt`, ignorado por git. Repártelas por un canal privado; cada persona debe cambiar la suya al entrar. Si alguien la pierde, un admin la restablece en **Admin → Personas**. Ahí mismo se crean cuentas nuevas: el sistema genera su contraseña temporal y la muestra una sola vez.

3. En Render: **New → Blueprint**, elige el repositorio y pega la misma cadena en `DATABASE_URL`. `SESSION_SECRET` se genera solo.

El plan gratis de Render se apaga tras unos minutos sin tráfico: la primera visita después de eso tarda cerca de un minuto. Nunca corras `pnpm test`, `pnpm e2e` ni `db:seed` contra Neon: borran y resiembran.

### Activar la voz en producción

Render no sirve para alojar LiveKit, que necesita puertos UDP. Usa LiveKit Cloud, con plan gratis sin tarjeta:

1. Crea un proyecto en https://cloud.livekit.io y una API key en su configuración.
2. En Render → Environment agrega `LIVEKIT_URL` (la `wss://…livekit.cloud`), `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET`, y guarda para redesplegar.

El plan gratis da 5.000 minutos de conexión al mes. El walkie solo se conecta al hablar o escuchar y se suelta tras 90 segundos sin uso; “Hablar aquí” consume mientras estés dentro, así que las reuniones largas van mejor por Teams.

## Correr todo con Docker Compose

```bash
docker compose up --build
docker compose exec server npx tsx src/seed.ts   # datos de ejemplo, la primera vez
```

Levanta `client` (5173), `server` (2567 multijugador y 2568 API), `postgres` y `redis`.

## Calidad

Las pruebas de integración y las e2e **borran y vuelven a sembrar** la base a la que apunten. Para no perder lo que hayas decorado, córrelas contra una base aparte (con `DATABASE_URL` en el entorno, que manda sobre `.env`):

```powershell
docker compose exec -T postgres psql -U laofi -d laofi -c "CREATE DATABASE laofi_test;"   # solo la primera vez
$env:DATABASE_URL = 'postgresql://laofi:laofi_dev@localhost:5432/laofi_test'
pnpm --filter @laofi/server exec prisma migrate deploy
pnpm test
```

```bash
pnpm typecheck     # TypeScript estricto en los tres paquetes
pnpm lint          # ESLint
pnpm format:check  # Prettier
pnpm test          # Vitest: lógica compartida + integración del servidor contra Postgres
pnpm check         # todo lo anterior

npx playwright install chromium   # solo la primera vez
pnpm e2e           # Playwright: un día de trabajo con dos personas de células distintas
```

`pnpm test` y `pnpm e2e` **vuelven a sembrar la base** de `DATABASE_URL` (borran todo). Úsalos contra la base de desarrollo, nunca contra una con datos reales. `pnpm e2e` levanta el servidor y el cliente si no están corriendo.

## Estructura

```
apps/
  client/     React + Vite + three.js + zustand + livekit-client
    src/scene   motor isométrico: piso, paredes con corte, muebles, avatares, modo edición
    src/ui      login, HUD, dock, paneles (ficha, directorio, edificio, notas, oficina, avatar, admin)
    src/net     API REST, conexión con la room del piso, voz
    src/state   store de la interfaz (zustand)
  server/     Colyseus + Fastify + Prisma
    src/rooms     FloorRoom: una instancia por piso, autoridad de todo cambio
    src/api       rutas REST (sesión, edificio, directorio, notas, salas, voz, admin)
    src/auth      contraseñas (scrypt), tokens (JWT) y AuthProvider (Entra ID en la Fase 3)
    src/presence  PresenceService: quién está en qué piso y sala
    src/jobs      limpieza de post-its y toques de más de 30 días
    prisma/       esquema y migraciones
packages/
  shared/     tipos, grilla con paredes y puertas, A*, catálogo, validación de muebles, mensajes (zod)
e2e/          pruebas de Playwright
docs/         DECISIONES.md
```

## Cómo funciona

1. El login (`POST /api/auth/login`) deja una cookie de sesión httpOnly. Vite reenvía `/api` al puerto 2568, así la cookie es del mismo origen.
2. Para entrar a un piso, el cliente pide un token corto (`POST /api/auth/room-token`, 2 minutos) y se une a la room `floor` con `{ floorId, token }`. Todas las personas del mismo piso comparten la room.
3. El cliente solo pide cosas (moverse, tocar, colocar un mueble). El servidor valida con zod y con la misma lógica de `packages/shared`, guarda en Postgres y sincroniza el estado a 20 ticks por segundo.
4. La geometría del piso (oficinas, salas, links) viene por REST; cuando el admin cambia algo, la room sube `layoutVersion` y los clientes la vuelven a pedir.
