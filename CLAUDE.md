# Guía para Claude Code · Kumo

Monorepo pnpm + Turborepo. Dos superficies: `apps/web` (Next.js) y `apps/mobile`
(Expo), sobre una capa compartida `packages/shared` y backend Supabase.

`apps/web` contiene las tres secciones en una sola app, así comparten origen y
la sesión de Supabase sin configurar nada:

| Ruta     | Qué es              | Código                |
| -------- | ------------------- | --------------------- |
| `/`      | la web pública      | `app/page.tsx`        |
| `/app`   | la cuenta del socio | `app/app/`            |
| `/admin` | el panel del club   | `app/admin/`          |

## Reglas del proyecto
- **Identidad visual**: usar SIEMPRE los tokens de `@kumo/shared` (colores,
  fuentes Baloo 2 + DM Sans). No hardcodear colores nuevos.
- **Tipos**: `packages/shared/src/types.ts` es la fuente de verdad y debe
  quedar alineado con `supabase/schema.sql`. Si cambia uno, cambiar el otro.
- **Referencia visual**: `reference/kumo-prototype.html` es el diseño exacto a
  reproducir. Abrilo para ver el detalle de cualquier pantalla antes de portarla.
- **CSS**: un solo `app/globals.css` para las tres secciones. Las clases de cada
  una van prefijadas (`.r-` público, `.wa-` socio, `.adm-` panel) para que no se
  pisen. El fondo propio del panel se aplica en `app/admin/layout.tsx`.
- **Rutas entre secciones**: usar `urls` de `@kumo/shared`, nunca hardcodear.
- **Realtime**: para datos que se actualizan en vivo, usar `subscribeTable`
  de `@kumo/shared` (ver firma en `packages/shared/src/supabase.ts`). Hoy lo usa
  el panel de admin para los reintegros: avisa que entró uno nuevo con un cartel,
  sin recargar la lista sola —si se reordenara debajo del cursor, el "Aprobar"
  que estás por tocar podría pasar a ser el de otra solicitud—.
- **NADA que se arrastre o se anime va adentro de un `Modal`** (React Native).
  En Android, adentro de un `Modal` los cambios de POSICIÓN sobre vistas que ya
  están montadas no se dibujan: el gesto llega, la cuenta da bien y la pantalla
  no cambia. Lo único que ese modal propaga es la creación de vistas nuevas, así
  que un botón que cambia el zoom parece andar y el arrastre no. Reproducido en
  un emulador y probado sin éxito con posición, transformación anidada,
  `Animated.View`, `Animated.ValueXY` y `collapsable={false}`. El patrón del
  proyecto para pantalla completa es **página**: se devuelve EN LUGAR de la
  pantalla, como `CalendarioPagina` y `MapaPagina` en `apps/mobile/App.tsx`.
  El `Modal` sigue bien para hojas y diálogos, que no se arrastran.
- **Clientes de Supabase** (`apps/web/lib/`), cada uno con su propósito:
  `supabase-browser` (navegador, sesión en cookies), `supabase-server`
  (Server Components, lee la sesión), `supabase-public` (anon sin cookies, para
  contenido cacheable) y `supabase-service` (service-role, ignora RLS: SOLO en
  route handlers).
- **Secretos**: la `SUPABASE_SERVICE_ROLE_KEY` solo en código de servidor.
- **React**: las dos superficies están en React 19 desde el SDK 57 de Expo
  (antes mobile estaba clavado en 18.2.0 porque lo exigía Expo 51). Mantenerlas
  alineadas: cuando se separaron hubo que excluir `@types/react` del hoist de
  pnpm, y esa exclusión terminó rompiendo los tipos de los paquetes anidados
  (ver el comentario en `.npmrc`).
- **Node 22+**: lo exige el toolchain de Expo 57. Está en `.nvmrc`, así que
  `nvm use` en la raíz alcanza.
- **`.npmrc`**: no volver a poner `node-linker=hoisted` — rompe el build de
  producción de Next (ver el comentario en el archivo).

## Comandos
- `pnpm install` — instalar todo.
- `pnpm dev:web` — el sitio en el puerto 3000 (las tres secciones).
- `pnpm dev:mobile` — la app Expo.
- `pnpm --filter @kumo/mobile run web` — la app Expo en el navegador (puerto 8081).
  Levantarla en una terminal aparte: el preview del editor la mata (por eso
  `mobile-web` no está en `.claude/launch.json`). Sí sobrevive lanzada en segundo
  plano con `nohup ... & disown`, que es el camino para automatizarla. El 8081 es fijo: es el puerto que espera Metro y del
  que depende la URL de red para abrir la app en un celular.
- `pnpm typecheck` / `pnpm lint` — chequeos.
- `pnpm --filter @kumo/web run build` — build de producción (correrlo antes de
  deployar: hay errores que solo aparecen ahí). **Bajar el dev server antes**:
  comparten `apps/web/.next` y el build lo sobreescribe, con lo que el dev queda
  sirviendo 404 en sus chunks (`main-app.js`) y la página no hidrata — se ve como
  "los clics no hacen nada". Si pasa: matar el server, `rm -rf apps/web/.next` y
  levantarlo de nuevo.
- `pnpm db:reset` / `pnpm db:push` — recrear la base local con schema + seed, y
  empujar las migraciones. Necesitan el CLI de Supabase instalado; en una máquina
  que no lo tenga, las migraciones se corren a mano en el SQL Editor.
- `vercel --prod` — publicar producción (el push a GitHub NO deploya). **Correrlo
  desde la raíz del repo, nunca desde `apps/web`**: la raíz es la que está
  linkeada al proyecto `kumo` (`.vercel/project.json`), y Vercel ahí ve el
  monorepo y usa pnpm. Parado en `apps/web` ve una app Next suelta, instala con
  npm —que no entiende `workspace:*`— y el build falla; peor, al no encontrar
  proyecto linkeado **crea uno nuevo** con el nombre de la carpeta (`web`) en el
  scope personal. Ya pasó una vez. Después del deploy, verificar en `kumo.pet`.

## Cómo llega cada cambio a la gente
Tres caminos distintos, y confundirlos hace perder horas esperando algo que nunca
va a llegar:

- **`apps/mobile` → OTA.** `eas update --branch production --environment production`
  desde `apps/mobile`. Hay DOS canales (`apk` y `production`) y el que usa la
  gente de Google Play es `production`. Se baja en una apertura de la app y se
  aplica en la siguiente, así que "ya actualicé" no alcanza: mirar la línea de
  versión al pie de **Mi perfil**, que dice qué OTA está corriendo (`Kumo 1.0.0 ·
  01a0629b`) y el canal cuando no es producción. Sin eso no hay forma de saber si
  alguien está viendo el arreglo o el bundle viejo.
- **`apps/web` → deploy.** Incluye los crons y las API routes, que corren en el
  servidor: no necesitan OTA ni tocan la app.
- **Nativo → build nuevo.** Splash, íconos, permisos, un paquete con código
  nativo. Es lo único que NO viaja por OTA: cambiarlo y publicar un update deja
  todo igual en el teléfono.

## Idioma
- Producto y UI en español rioplatense (Argentina). Moneda ARS.
