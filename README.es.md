<p align="center">
  <img src=".github/assets/logo.svg" alt="" width="72" />
</p>

<h1 align="center">TitanLive</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.pt-BR.md">Português (Brasil)</a> · <b>Español</b>
</p>

<p align="center">
  Miren juntos y hablen en vivo: comparte tu pantalla y habla por voz con hasta 10 personas, directo desde el navegador. Sin registro, sin instalar nada, solo envía el enlace.
</p>

<p align="center">
  <img alt="NestJS 11" src="https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs&logoColor=white" />
  <img alt="Socket.IO 4" src="https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white" />
  <img alt="WebRTC" src="https://img.shields.io/badge/WebRTC-P2P-333333?logo=webrtc&logoColor=white" />
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" />
  <img alt="Playwright" src="https://img.shields.io/badge/tests-Playwright%20%2B%20Jest-2ead33?logo=playwright&logoColor=white" />
</p>

<p align="center">
  <img src=".github/assets/room.png" alt="Una sala de TitanLive: la pantalla compartida a la izquierda, las personas con cápsulas de estado y el chat con una nota de voz a la derecha" />
</p>

> [!NOTE]
> **No se guarda nada.** Las salas existen solo en la memoria del servidor. Los mensajes y archivos del chat se reenvían a quienes están en la sala y desaparecen cuando sales. El audio y el video van directo entre las personas por WebRTC.

## Funciones

- **Sala en un clic**: un enlace aleatorio es la llave. Solo entra quien recibe el enlace, hasta 10 personas por sala.
- **Compartir pantalla**: una persona comparte y todos miran en el escenario.
- **Voz**: activa o silencia el micrófono con un botón, y un anillo dorado muestra quién habla. ¿Entraste sin micrófono? Actívalo después.
- **Chat con multimedia**: texto, imágenes, videos y archivos de audio (hasta 8 MB cada uno), y notas de voz grabadas en el propio chat.
- **Controles en un solo lugar**: micrófono, compartir pantalla y salir van juntos en una barra sobre el escenario, y copiar enlace queda junto al nombre de la sala.
- **Quién está aquí**: los avatares de todos junto al contador y cápsulas de estado para *tú*, *silenciado* y *compartiendo*.
- **Se reconecta solo** cuando se cae la conexión.
- **Español, English y Português**, tema oscuro y claro.
- **Listo para TURN**: un `docker-compose.yml` con coturn para quien está detrás de un NAT restrictivo.

## Capturas

**Inicio**: crea una sala o pega un enlace.

<p align="center"><img src=".github/assets/home-es.png" alt="Inicio en español, tema oscuro" /></p>

**Tema claro** y **Português**:

<p align="center">
  <img src=".github/assets/home-light-en.png" alt="Inicio en inglés, tema claro" width="49%" />
  <img src=".github/assets/home.png" alt="Inicio en portugués, tema oscuro" width="49%" />
</p>

## Cómo empezar

Necesitas [Node.js](https://nodejs.org) **20.19 o más reciente**.

```sh
git clone https://github.com/SamuelSchutz13/TitanLive.git
cd TitanLive

cd server && npm install && npm run start:dev   # http://localhost:3000
cd ../web && npm install && npm run dev         # http://localhost:5173
```

Abre http://localhost:5173, elige un apodo y crea una sala.

### Configuración

`server/.env` (copia de `server/.env.example`):

| Variable                      | Descripción                                                         |
| ----------------------------- | ------------------------------------------------------------------- |
| `PORT`                        | Puerto del servidor (por defecto `3000`)                            |
| `WEB_ORIGIN`                  | Origen permitido para el sitio (por defecto: cualquiera)            |
| `TURN_URLS`, `TURN_SECRET`    | Relay TURN (coturn `use-auth-secret`). Vacío = solo STUN            |
| `OTEL_*`                      | Exportación OpenTelemetry en `npm run start:prod` (SigNoz u OTLP)   |

`web/.env`: `VITE_SERVER_URL` (por defecto `http://localhost:3000`).

TURN para redes restrictivas:

```sh
TURN_SECRET=cambia-esto docker compose up -d   # en producción, define TURN_EXTERNAL_IP con la IP pública
```

### Scripts

| Dónde     | Comando              | Qué hace                                             |
| --------- | -------------------- | ---------------------------------------------------- |
| `server/` | `npm run start:dev`  | Servidor con recarga en el puerto 3000               |
| `server/` | `npm run test:e2e`   | Jest: salas, señalización, chat y archivos           |
| `server/` | `npm run start:prod` | Servidor compilado con OpenTelemetry                 |
| `web/`    | `npm run dev`        | Vite con recarga en caliente                         |
| `web/`    | `npm run build`      | Revisa los tipos y genera `web/dist`                 |
| `web/`    | `npm run test:e2e`   | Playwright: navegadores reales entrando a salas      |

## Privacidad y seguridad

- **Sin cuentas y sin historial.** Las salas solo existen en memoria mientras haya alguien en ellas.
- **Privada por enlace.** El código de la sala tiene 96 bits aleatorios, generados en el navegador.
- **Multimedia directa entre personas.** El servidor solo reenvía la señalización WebRTC entre quienes están en la misma sala.
- **Archivos validados y nunca guardados.** Solo `image/*`, `video/*` y `audio/*` de hasta 8 MB, reenviados sin almacenar.
- **Límites en el servidor**: apodo de hasta 32 caracteres, mensajes de hasta 500, 5 mensajes cada 5 segundos por persona, 10 personas por sala.
- **El TURN nunca reenvía a redes privadas**: coturn bloquea los rangos privados y de loopback.

## Cómo funciona

```
navegador (Vite + TypeScript)  ⇄  Socket.IO  ⇄  NestJS (señalización, chat)
        ⇅ WebRTC (pantalla + voz, directo entre personas, TURN cuando hace falta)
navegador  ⇄  navegador
```

Los eventos Socket.IO y los errores están en [server/README.md](server/README.md), y Swagger corre en `http://localhost:3000/docs`.
