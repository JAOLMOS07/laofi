# La Ofi — Oficina virtual isométrica para equipos de desarrollo

> Documento maestro del proyecto. Claude Code: lee este archivo completo antes de cualquier tarea.
> "La Ofi" es un nombre provisional; el equipo puede cambiarlo.

---

## 1. Visión

Un **edificio virtual en 3D con vista isométrica**, al estilo Habbo pero moderno, donde cada persona del equipo tiene su oficina personalizable. Cada célula de desarrollo tiene su piso, QA tiene el suyo y existen zonas comunes. Todos ven en tiempo real dónde está cada quien y qué está haciendo.

**Objetivo real (no negociable):** la app tiene que **reemplazar fricciones que ya existen**, no ser solo un juguete:
- "¿Estás disponible?" → se ve la presencia y existe el "toc toc".
- "¿Cuál es el link de la reunión?" → cada sala tiene su reunión de Teams.
- "¿Ya me pasaste eso a QA?" → las entregas se ven como cajas que viajan al muelle de QA.
- "¿Dónde está X?" → directorio con "ir a su puerta".

**Principios:**
1. **Divertido pero útil.** Cada feature visual debe ahorrar al menos una pregunta o un clic.
2. **Teams sigue siendo la herramienta de reuniones.** No replicamos compartir pantalla ni videollamadas grandes; abrimos Teams.
3. **Privacidad primero.** Nada de rastrear teclas, tiempo activo ni actividad del computador. Cada persona controla su estado. Todo lo automático es opt-in.
4. **Gratis.** Solo herramientas open source o de nivel gratuito, alojadas por nosotros.
5. **Ligero.** Debe correr bien en laptops de oficina normales: low-poly y pocas luces.

---

## 2. Contexto del equipo

- El equipo trabaja por **células** de desarrollo, más un equipo de **QA**.
- **Infra** es otro equipo que probablemente **no usará la app**, pero participa en reuniones de planeación.
- Herramientas actuales: **Microsoft Teams** (reuniones, voz, compartir pantalla, calendario), **Azure** (por confirmar si se usa **Azure DevOps** para work items y pipelines), **AWS** y **Discord** (secundario).
- **No** queremos métricas de producción ni transacciones; están fuera del radar del equipo.

---

## 3. Conceptos del dominio

| Concepto | Descripción |
|---|---|
| **Edificio** | El mundo completo. Contiene pisos y zonas comunes. |
| **Piso** | Pertenece a una célula (dev o QA). Tiene oficinas y salas propias, con la identidad visual de la célula (colores, logo, nombre). |
| **Lobby** | Zona común de entrada, con el directorio, los anuncios y el tablero de entregas. |
| **Zonas comunes** | Lobby, cafetería (informal), auditorio (demos y town halls) y salas de reunión compartidas. |
| **Oficina** | Espacio personal de cada usuario dentro del piso de su célula. Es editable por su dueño. |
| **Sala** | Espacio de reunión, de célula o compartida. Tiene una reunión de Teams asociada y voz propia en la app. |
| **Visitante** | Usuario que está en un piso que no es el de su célula. Se muestra con un badge de su célula. |
| **Invitado externo** | Persona que no usa la app pero está en una reunión (por ejemplo, infra). Se muestra como avatar genérico **solo dentro de la sala y mientras dura la reunión**. |
| **Entrega** | Un desarrollo enviado de dev a QA. Se representa como una caja con el nombre del work item. |

---

## 4. Funcionalidades por fase

Construir **estrictamente por fases**. No avanzar de fase sin que la anterior funcione de punta a punta y sin confirmación del usuario.

### Fase 0 — Base técnica
- Monorepo, tooling, linting, formato, tests y Docker Compose para el entorno local.
- Escena 3D mínima con cámara ortográfica isométrica, un piso de grilla y un avatar que se mueve con clic.
- Servidor multijugador con dos clientes que se ven moverse en tiempo real.

**Criterio de aceptación:** al abrir dos pestañas, cada avatar se ve moverse en la otra con latencia baja.

### Fase 1 — MVP
1. **Auth simple.** Login con email y contraseña o magic link, solo para desarrollo. Dejarlo detrás de una interfaz para cambiarlo a Microsoft Entra ID (SSO) después.
2. **Edificio** con **2 pisos de células**, un **lobby** y **una sala compartida**. Navegación entre pisos por ascensor (UI de selección de piso) con transición suave.
3. **Avatares** personalizables por capas: color de piel, pelo, ropa, accesorios y colores. Movimiento por clic con pathfinding en grilla (A*), evitando muebles y paredes.
4. **Oficinas editables (modo edición):**
   - Catálogo de muebles: escritorio, silla, planta, estante, cuadro, lámpara, sofá, alfombra, entre otros.
   - Colocar en grilla, rotar en pasos de 90°, mover, eliminar y cambiar colores.
   - Cambiar el color o la textura de paredes y piso.
   - Solo el dueño puede editar su oficina. Los cambios se ven en tiempo real para los demás.
5. **Estados de presencia:** disponible, ocupado, en foco (puerta cerrada y letrero de "no molestar"), en reunión y ausente. Los pone el usuario a mano.
6. **"Toc toc":**
   - Al llegar a la puerta de una oficina, el visitante puede tocar.
   - El dueño recibe una notificación in-app (toast y sonido) con las opciones "Pasa", "Dame 10 min" y "Ahora no".
   - Si la puerta está en foco, el toque queda en cola como notificación silenciosa.
7. **Post-its:** dejar una nota en el escritorio de alguien. El dueño la ve cuando vuelve y puede marcarla como leída.
8. **Salas con Teams:**
   - Cada sala tiene un **link de Teams fijo**, que configura un admin.
   - Al entrar a la sala aparece un panel con dos opciones: **"Hablar aquí"** (voz en la app) y **"Abrir en Teams"** (abre el link de la reunión en la app de Teams).
   - Sobre cada avatar se muestra un ícono con su modo: en la app, en Teams o solo presente.
9. **Walkie-talkie:** push-to-talk (mantener una tecla o botón) para hablarle a una persona, a la sala actual o a todo el piso. La voz va por LiveKit.
10. **Directorio:** buscador de personas que muestra su piso, su estado y un botón "ir a su puerta" (teletransporte a la puerta de la oficina).
11. **Badge de visitante** al estar en un piso ajeno.
12. **Mapa del edificio:** vista resumida con cuántas personas hay en cada piso y qué salas están ocupadas.
13. **Panel admin básico:** crear células y pisos, asignar usuarios a células, configurar salas y links de Teams, y cerrar o abrir pisos.

**Criterio de aceptación:** dos células pueden pasar un día de trabajo usando la app: visitarse, tocar puertas, dejar notas y entrar a la sala para abrir la reunión de Teams.

### Fase 2 — Integraciones de flujo de trabajo
> Antes de arrancar esta fase, **detenerse y preguntar al usuario** lo indicado en la sección 9 (preguntas abiertas).

1. **Calendario (Microsoft Graph):**
   - Leer los eventos del usuario (permiso delegado `Calendars.Read`).
   - Un minuto antes de una reunión, mostrar el aviso "Tu reunión X empieza: ¿vamos?".
   - Al aceptar, el avatar camina (o se teletransporta) a la sala asignada. Si el evento tiene link de Teams (`onlineMeeting.joinUrl`), el botón "Abrir en Teams" usa ese link.
   - Al terminar la reunión, el avatar vuelve a su oficina (opt-in).
   - Mapeo de evento a sala: por nombre de la sala en la ubicación del evento, por regla configurable o, en su defecto, la sala de la célula.
2. **Presencia de Teams (opcional):** sincronizar ocupado/en llamada vía Graph `Presence.Read`, solo si TI lo permite y el usuario lo activa.
3. **Entregas a QA (Azure DevOps service hooks):**
   - Webhook cuando un work item cambia al estado configurado (por ejemplo, "Ready for QA").
   - Se crea una **caja** con el ID y el título del work item, que viaja con una animación desde el piso de la célula hasta el **muelle de entregas** del piso de QA.
   - Estados de la caja: enviada, en pruebas, aprobada (verde) y devuelta (roja, regresa al piso dev con una etiqueta de bug).
   - **Tablero de entregas** en el lobby: enviadas, en pruebas, aprobadas y devueltas en el día o en el sprint.
4. **Pisos para QA** con muelle de entregas y su propia identidad visual.

### Fase 3 — Extras
1. **Invitados externos:** si un evento de calendario incluye asistentes que no están en la app (por ejemplo, infra), se muestran en la sala como avatares genéricos con el rótulo "Nombre del equipo (vía Teams)" **solo mientras dura la reunión**. Sin estado ni presencia fuera de ella.
2. **Piso de infra "en construcción"**, listo para cuando quieran unirse.
3. **Deploys:** eventos de pipelines de Azure DevOps y/o AWS (CodePipeline vía EventBridge → webhook) representados como un trencito que cruza el piso de la célula. Si el deploy falla, la sala de la célula parpadea en rojo.
4. **Repisa de trofeos automática:** logros como "50 PRs aprobados", "Entrega sin bugs", "Cazabugs del sprint" o "Primer deploy". Opt-in y sin rankings competitivos públicos entre personas.
5. **Mascota de escritorio** decorativa.
6. **Reuniones improvisadas:** crear una reunión de Teams al vuelo vía Graph (`OnlineMeetings.ReadWrite`), si TI lo permite.
7. **Discord (opcional):** notificaciones de "toc toc" y post-its por DM.
8. **Auth con Microsoft Entra ID (SSO).**

---

## 5. Stack técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Lenguaje | TypeScript en todo el proyecto | `strict: true` |
| Monorepo | pnpm workspaces | `apps/client`, `apps/server`, `packages/shared` |
| Frontend | React + Vite | |
| 3D | three.js + **@react-three/fiber** + **@react-three/drei** | Cámara **ortográfica** isométrica, con zoom y rotación en pasos de 90° |
| Estado cliente | zustand | |
| UI 2D | Tailwind CSS + componentes propios | Paneles, toasts, directorio, editor |
| Multijugador | **Colyseus** | Una room por piso o zona; schema sincronizado |
| API REST | Fastify, en el mismo proceso del server o separado | CRUD de oficinas, muebles, notas, admin y webhooks |
| Base de datos | PostgreSQL + Prisma | |
| Cache / pub-sub | Redis (opcional en el MVP) | Presencia global si hay varias instancias |
| Voz | **LiveKit** (self-hosted en Docker) | Walkie-talkie y "Hablar aquí" |
| Assets 3D | Kits low-poly **CC0** (por ejemplo, los de Kenney) en glTF/GLB | Verificar la licencia de cada kit y registrarla en `ASSETS.md` |
| Pathfinding | A* sobre grilla | En `packages/shared` para reutilizarlo en el cliente y el servidor |
| Tests | Vitest (unidad) + Playwright (e2e básico) | |
| Infra local | Docker Compose: postgres, redis, livekit, server y client | |
| Deploy futuro | AWS (EC2/ECS) o lo que defina el equipo | No es prioridad en el MVP |

---

## 6. Arquitectura

```
apps/
  client/          # React + R3F
    src/
      scene/       # Edificio, pisos, oficinas, avatares, muebles, cámara
      ui/          # Paneles, directorio, toasts, editor, panel de sala
      net/         # Cliente Colyseus, cliente REST, LiveKit
      state/       # stores zustand
  server/
    src/
      rooms/       # FloorRoom (Colyseus), una instancia por piso o zona
      presence/    # PresenceService global (quién está en qué piso + estado)
      api/         # Rutas REST
      integrations/
        graph/     # Microsoft Graph (fase 2)
        devops/    # Webhooks de Azure DevOps (fase 2)
        aws/       # Webhooks de EventBridge (fase 3)
        discord/   # (fase 3, opcional)
      auth/        # Interfaz AuthProvider: DevAuthProvider y EntraAuthProvider
packages/
  shared/          # Tipos, schemas de mensajes, grilla, pathfinding, constantes
```

**Decisiones clave:**
- **Una room de Colyseus por piso o zona.** Solo se sincroniza el movimiento entre quienes comparten piso. Cambiar de piso significa salir de una room y unirse a otra.
- **PresenceService global**, ligero: el mapa userId → {pisoId, salaId?, estado, modoVoz}. Alimenta el directorio y el mapa del edificio sin que el cliente esté en todas las rooms.
- **El servidor es la autoridad** de la posición. El cliente envía el destino, el servidor valida el camino y difunde. El cliente interpola el movimiento.
- **Integraciones desacopladas:** cada una emite eventos de dominio internos (`delivery.created`, `meeting.starting`, etc.) que consumen las rooms. Ninguna integración debe ser requisito para que la app funcione.
- **Los secretos van en `.env`** y nunca en el repo. Incluir un `.env.example`.

---

## 7. Modelo de datos (inicial)

```
User        { id, email, name, cellId, avatarConfig(json), status, createdAt }
Cell        { id, name, type: DEV|QA|INFRA, color, logoUrl, floorId }
Floor       { id, name, cellId?, isCommon, isLocked, layout(json) }
Office      { id, ownerId, floorId, gridX, gridY, width, depth, wallColor, floorTexture }
Room        { id, floorId, name, type: CELL|SHARED|AUDITORIUM|CAFETERIA, teamsLink?, gridX, gridY, width, depth }
FurnitureCatalog { id, key, name, modelUrl, footprintW, footprintD, colorable }
PlacedFurniture  { id, officeId, catalogId, gridX, gridY, rotation(0|90|180|270), color? }
Note        { id, fromUserId, toUserId, text, readAt?, createdAt }
Knock       { id, fromUserId, toUserId, response?: ENTER|WAIT_10|NOT_NOW, createdAt }
Delivery    { id, externalId, title, fromCellId, status: SENT|TESTING|APPROVED|RETURNED, updatedAt }   # fase 2
Trophy      { id, userId, key, earnedAt }                                                           # fase 3
ExternalGuest (en memoria) { meetingId, roomId, label, until }                                      # fase 3
```

---

## 8. Mensajes en tiempo real (Colyseus)

Cliente → servidor:
- `move { x, y }` (destino en la grilla)
- `set_status { status }`
- `knock { toUserId }`, `knock_response { knockId, response }`
- `note_create { toUserId, text }`
- `furniture_place | furniture_move | furniture_remove | furniture_recolor`
- `room_enter { roomId }`, `room_leave`
- `voice_mode { mode: APP|TEAMS|NONE }`
- `ptt_start { target: USER|ROOM|FLOOR, id }`, `ptt_stop`

Servidor → cliente (vía schema de estado y eventos):
- Estado sincronizado del piso: jugadores (posición, estado, avatar, modoVoz, esVisitante) y muebles de las oficinas.
- Eventos: `knock_received`, `knock_answered`, `note_received`, `meeting_starting` (fase 2), `delivery_update` (fase 2), `deploy_event` (fase 3).

Validar todos los mensajes con zod, usando schemas compartidos en `packages/shared`.

---

## 9. Preguntas abiertas: preguntar al usuario antes de construir

1. **Azure DevOps: CONFIRMADO que lo usan.** Ya existen bots que envían a Discord avisos de DevOps (por ejemplo, ramas no integradas a main después de un despliegue). Hay que averiguar cómo están montados (service hook, tarea del pipeline o bot externo) y reutilizar ese mismo mecanismo para nuestros webhooks. Sigue pendiente: ¿cómo marcan una entrega a QA (estado del work item, tag, PR o release)? ¿Cuál es el nombre exacto del estado?
2. **¿TI permite registrar una app en Microsoft Entra ID** con permisos delegados de Graph (`Calendars.Read`, `Presence.Read`, `OnlineMeetings.ReadWrite`)? ¿Requiere consentimiento de admin? **PENDIENTE.** Que DevOps permita webhooks NO implica permisos de Entra/Graph; son sistemas y administradores distintos.
3. **¿Dónde se va a alojar?** ¿Servidor interno, AWS de la empresa o una máquina del equipo? ¿Hay restricciones de red o VPN?
4. ¿Cuántas células y personas hay, aproximadamente? (Para dimensionar pisos y rooms.)
5. ¿Hay lineamientos de seguridad de la empresa para apps internas (datos de usuarios, auditoría)?
6. Nombre final de la app y estilo visual preferido (paleta y tono más "cozy" o más "corporativo").

Si una respuesta bloquea una integración, **seguir con el plan B**: links fijos de Teams, estados manuales y entregas registradas a mano desde un botón.

---

## 10. Dirección visual

- Low-poly, colores cálidos y amigables, sombras suaves y una sola luz direccional con ambiente.
- Vista isométrica con zoom y rotación en pasos de 90°. Paredes frontales semitransparentes o recortadas para ver el interior de las oficinas.
- Cada piso usa la paleta de su célula.
- Nombres sobre los avatares, con un ícono de estado y el modo de voz.
- Animaciones simples: caminar, idle, sentarse en la silla del escritorio (en fase 2 o cuando sea fácil) y las cajas de entrega viajando.
- La UI 2D es mínima y no tapa la escena. Debe tener modo claro y oscuro.
- Rendimiento objetivo: 60 fps con 30 avatares en un piso en una laptop de oficina normal.

---

## 11. Privacidad y reglas de convivencia

- No registrar actividad del sistema operativo, del teclado, del IDE ni tiempo activo.
- Las integraciones automáticas (calendario, presencia de Teams, movimiento automático) son **opt-in por usuario**.
- Los invitados externos solo aparecen dentro de reuniones y como "invitado de X equipo".
- Los trofeos son opt-in, sin rankings públicos entre personas.
- Los pisos pueden cerrarse temporalmente (planning, incidentes). Los visitantes ven un letrero.
- Los post-its y los toques se guardan un tiempo limitado (configurable, por defecto 30 días).

---

## 12. Cómo debe trabajar Claude Code en este proyecto

1. **Antes de cada fase:** proponer un plan corto con los archivos a crear, las decisiones a tomar y los riesgos, y esperar la confirmación del usuario.
2. **Trabajar en pasos pequeños y verificables.** Al final de cada paso, decir qué se hizo, cómo probarlo (comandos exactos) y qué sigue.
3. **Preguntar en vez de suponer** cuando algo de la sección 9 afecte lo que se construye.
4. **Mantener la app funcional siempre.** Nada de dejar la rama principal rota.
5. **Tests:** pruebas unitarias para la lógica compartida (grilla, pathfinding, validación de mensajes, reglas de permisos) y un e2e básico por fase.
6. **Documentar mientras se construye:** mantener `README.md` (cómo correr el proyecto), `docs/DECISIONES.md` (decisiones técnicas con fecha y razón) y `ASSETS.md` (origen y licencia de cada asset).
7. **No agregar dependencias pagas** ni servicios con costo sin preguntar.
8. **No inventar APIs.** Para Microsoft Graph, Azure DevOps, LiveKit y Colyseus, consultar la documentación oficial actual antes de implementar, porque pueden haber cambiado.
9. **Si algo de este documento parece mala idea o hay una mejor alternativa, decirlo directamente**, con la razón, antes de implementarlo.
10. Responder siempre en **español**.

---

## 13. Definición de "listo" del MVP

- [ ] `docker compose up` levanta todo el entorno local con un solo comando.
- [ ] Varios usuarios se ven moverse en tiempo real en el mismo piso.
- [ ] Se puede ir del piso propio al lobby y a otro piso, y aparecer con el badge de visitante.
- [ ] Cada usuario decora su oficina y los demás ven los cambios en vivo.
- [ ] El "toc toc" y los post-its funcionan entre células.
- [ ] Las salas muestran el panel "Hablar aquí / Abrir en Teams" y el link de Teams abre la reunión.
- [ ] El walkie-talkie funciona a persona, a sala y a piso.
- [ ] El directorio encuentra personas y lleva a su puerta.
- [ ] El panel admin permite configurar células, pisos, salas y links de Teams.
- [ ] El README explica cómo correr el proyecto y cómo invitar al equipo.
