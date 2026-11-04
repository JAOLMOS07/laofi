# Decisiones técnicas

Registro de decisiones con fecha y razón. Lo más nuevo va arriba.

## 2026-11-04 · Fase 1

**Estructura del equipo real en los datos de ejemplo.** Un piso por célula (Axis 4, Hextech 3, Atlas 5, QA 4 de ejemplo), John (jefe de desarrollo) y Donovan (gerente de tecnologías) con oficina en el Lobby, Jhoger como admin. Salas: la de cada célula con su daily, el Auditorio para el daily general, la Sala de líderes y la **Sala libre**, donde cualquiera pega el link de una reunión planeada (las esporádicas tienen link nuevo cada vez, así que no tiene sentido que solo el admin lo cambie).

**API REST con Fastify en un puerto aparte (2568).** Colyseus sigue en 2567. Separarlos evita mezclar el servidor HTTP de Colyseus con las rutas y deja probar la API con `fetch` simple. El cliente llama a `/api` en su mismo origen y Vite la reenvía, así la cookie de sesión no necesita CORS.

**Sesión en cookie httpOnly (JWT HS256 con `jose`, 7 días) + token corto para la room (2 minutos).** El WebSocket de Colyseus va a otro puerto y no lleva la cookie, por eso el cliente pide un token de un solo uso práctico y lo manda en las opciones de entrada. `onAuth` lo verifica.

**Contraseñas con scrypt de `node:crypto` (parámetros de OWASP) en lugar de argon2.** argon2 trae binarios nativos que suelen romper la instalación en Windows. scrypt viene con Node y es suficiente para el login de desarrollo; en la Fase 3 el login pasa a Microsoft Entra ID mediante `AuthProvider`.

**Prisma 6.19 fijado.** Prisma 7 cambia la configuración (archivo `prisma.config.ts` y adaptadores obligatorios). La 6 es estable y conocida; se migra cuando haga falta.

**Paredes en los bordes de las baldosas, no como baldosas bloqueadas.** Las oficinas quedan de 6×5 útiles y las puertas son bordes abiertos. Una puerta cerrada (dueño en foco o ausente) es un borde bloqueado más; el dueño, o quien ya está adentro, sí la cruza. El cliente usa la misma geometría para el corte de paredes que miran a la cámara.

**Validación de muebles compartida.** `validatePlacement` (dentro de la oficina, sin tapar la entrada, sin encimar salvo alfombras debajo) la usan el cliente para la vista previa y el servidor como autoridad. El servidor además rechaza poner un mueble que bloquea donde hay alguien parado.

**Walkie-talkie: el servidor decide quién escucha.** El evento `ptt` solo llega a los destinatarios (una persona, la sala o el piso). Con LiveKit, cada piso es una sala de audio donde nadie se suscribe a nadie por defecto; el cliente se suscribe al micrófono de quien le habla solo mientras dura el evento. Así el audio sigue la misma regla que la interfaz.

**Voz opcional.** Si faltan las variables de LiveKit, `/api/voice/token` responde 503 y la app sigue sin audio. El token de voz solo se entrega para el piso o la sala donde la persona está en ese momento (según PresenceService).

**Links de Teams validados.** Solo `https://` en `teams.microsoft.com` o `teams.live.com` (o subdominios), sin usuario ni puerto. Evita que alguien pegue un enlace a otro sitio en una sala.

**Retención de 30 días.** Un job al arrancar y cada 6 horas borra post-its y toques más viejos. Las consultas también filtran por fecha, por si el job no ha corrido.

**Escena en three.js puro en lugar de React Three Fiber.** El prototipo que le gustó al equipo estaba hecho con three.js directo; portarlo tal cual (modelos, corte de paredes, etiquetas en una sola capa DOM) fue más rápido y más liviano que reescribirlo en R3F. React maneja solo la interfaz 2D. Se quitaron `@react-three/fiber`, `drei` y Tailwind (el CSS viene del prototipo).

**Muebles y avatares siguen hechos en código.** El estilo low-poly del prototipo es el que el equipo aprobó y no requiere revisar licencias. Los kits glTF quedan como opción futura, no como requisito.

**El estado de la room se copia a mapas mutables.** Las posiciones cambian 20 veces por segundo; la escena las lee en cada cuadro y React solo se actualiza cuando cambia algo visible en la interfaz (estado, sala, quién entra o sale).

**Las pruebas de integración y la e2e vuelven a sembrar la base de desarrollo.** Prueban contra Postgres real (no mocks). Por eso nunca deben apuntar a una base con datos reales.

## 2026-11-03 · Fase 2 sin integraciones externas

**Primero el flujo, después la fuente de datos.** Aún no se sabe cómo marcan una entrega en Azure DevOps ni si TI permite Graph. Se construyó todo lo visible con entrada manual, y `recordDelivery` y `Meeting` son el punto único de entrada: el webhook y el calendario solo tendrán que alimentarlos. Ninguna integración es requisito para que la app funcione.

**Lo pendiente queda a la vista y marcado.** El panel Integraciones dice qué funciona, qué es demo y qué necesita a TI, para que el equipo decida. Lo simulado queda con `source = DEMO`, se ve con etiqueta y se puede quitar sin tocar las entregas reales. No hay webhook real todavía: habría que inventar el estado y el formato, y el documento maestro pide no suponerlos.

**Agenda manual en vez de leer el calendario.** Mantiene el "¿vamos?" sin permisos. Calendario, presencia y SSO comparten requisito: la app registrada en Entra ID. El calendario delegado exige que cada persona se conecte con Microsoft, así que al menos un "Conectar mi calendario" tendría que adelantarse de la Fase 3.

**Las cajas viajan por los ascensores.** Cada piso es una escena aparte: la caja sale por el ascensor de la célula y llega por el del piso de QA. La animación es solo para quien está mirando ese piso; los demás ven la lista y el aviso.

**Muelle y tablero como instalaciones fijas en `floorFeatures`.** No son muebles editables y no hizo falta cambiar el layout guardado en la base, así que no hay que volver a sembrar. Bloquean el paso igual en el cliente y en el servidor.

**El aviso de reunión lo manda el servidor.** Un job revisa cada 5 s. Si la persona no está conectada, el aviso espera hasta 5 minutos después de la hora. El regreso a la oficina siempre pregunta: así el movimiento automático sigue siendo opt-in.

**Pruebas en una base aparte y e2e en serie.** Las pruebas siembran la base, así que se corren contra `laofi_test`. Las e2e van con `workers: 1` porque la app deja una sola sesión por persona y varias pruebas comparten cuentas.

## 2026-11-03 · Fase 0

**Colyseus 0.18 (servidor `@colyseus/core` + `@colyseus/ws-transport`, cliente `@colyseus/sdk`).**
Es la versión estable actual. La documentación web no se pudo consultar desde el entorno donde se armó la Fase 0, así que la API se verificó contra los tipos publicados del paquete y con una prueba de integración real (`apps/server/test/floorRoom.test.ts`) que levanta el servidor y conecta dos clientes. Si algo difiere de la doc oficial, manda la doc.

**Estado con `schema()` de `@colyseus/schema` 5 en lugar de decoradores `@type`.**
Los decoradores necesitan `experimentalDecorators` y `useDefineForClassFields: false`, que chocan con Vite y esbuild. El propio README de la librería recomienda `schema()`.

**Una room `floor` por piso, separada por `filterBy(['floorId'])`.**
Así solo se sincroniza el movimiento entre quienes comparten piso, como pide el documento maestro. Cambiar de piso será salir de una room y entrar a otra.

**El servidor es la autoridad del movimiento.**
El cliente solo envía el destino. El servidor valida con zod, calcula el camino con A* y avanza al avatar con `stepAlongPath` a 20 ticks por segundo. El cliente interpola con suavizado exponencial. Pathfinding y movimiento viven en `packages/shared` para reutilizarlos en ambos lados.

_*A* de 8 direcciones sin cortar esquinas, con montículo binario._*
Diagonales con costo √2 y heurística octile. No se permite pasar en diagonal entre dos bloques, para que los avatares no atraviesen esquinas de muebles o paredes.

**El paquete `shared` se consume como código TypeScript (sin compilar).**
Vite y `tsx` lo leen directo. Evita un paso de build y mantiene un solo origen. El servidor corre con `tsx` también en Docker; si más adelante pesa en producción, se agrega un build con esbuild.

**Fastify, Prisma y LiveKit quedan para la Fase 1.**
La Fase 0 no tiene REST ni base de datos ni voz. Postgres, Redis y LiveKit ya están en `docker-compose.yml` para no tocar la infraestructura después. LiveKit va en el perfil `voz` para no levantarlo sin necesidad.

**Muebles y avatares hechos con primitivas de three.js.**
Sirven para la Fase 0 sin licencias que revisar. En la Fase 1 se reemplazan por kits CC0 en glTF y se registran en `ASSETS.md`.

**Gancho `window.__laofi` solo en desarrollo.**
Permite que la prueba e2e mueva un avatar a una baldosa exacta sin depender de coordenadas de pantalla. No existe en el build de producción.

**Versiones principales:** React 19, Vite 8, three 0.187, @react-three/fiber 9, drei 10, zustand 5, Tailwind 4, zod 4, Vitest 5, Playwright, TypeScript 5 con `strict` y `noUncheckedIndexedAccess`.
