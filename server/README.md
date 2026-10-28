# TitanLive server

Sinalização WebRTC via Socket.IO. Salas só em memória: sem login, sem histórico.

```bash
npm i
npm run start:dev      # PORT=3000, WEB_ORIGIN=* por padrão
npm run test:e2e
```

Swagger em http://localhost:3000/docs (`GET /health` + resumo dos eventos Socket.IO).

## Eventos

| Cliente → servidor | Payload | Ack |
|---|---|---|
| `join` | `{ roomId, name, muted? }` | `{ id, peers: [{id,name,muted}], iceServers }` ou `{ error }` |
| `mute` | `{ muted }` | `{ ok }` ou `{ error }` |
| `signal` | `{ to, data }` | `{ ok }` ou `{ error }` |
| `chat` | `{ text }` ou `{ file: { type, data } }` | `{ ok }` ou `{ error }` |

| Servidor → cliente | Payload |
|---|---|
| `peer-joined` | `{ id, name, muted }` |
| `peer-muted` | `{ id, muted }` |
| `peer-left` | `{ id }` |
| `signal` | `{ from, data }` |
| `chat` | `{ from, name, text, at, file? }` |

Regras: `roomId` `[A-Za-z0-9_-]{6,64}` (gerado pelo cliente, aleatório = privado), nome até 32, chat até 500 caracteres ou um arquivo `image/*`, `video/*` ou `audio/*` de até 8 MB repassado sem guardar (máx. 5 mensagens a cada 5 s por pessoa), máx. 10 por sala.
Erros: `invalid-room`, `invalid-name`, `already-joined`, `room-full`, `invalid-peer`, `not-joined`, `invalid-text`, `invalid-file`, `file-too-big`, `invalid-mute`, `rate-limited`.

HTTP: `GET /rooms/:id` → `{ count, max }`, para a tela inicial avisar que a sala está cheia antes de entrar.

## TURN

Sem TURN, quem está atrás de NAT restritivo (rede corporativa, alguns 4G) não conecta. Com `TURN_URLS` e `TURN_SECRET` no `.env`, o ack do `join` traz credenciais válidas por 6 h no formato REST do coturn (`use-auth-secret`). O `docker-compose.yml` na raiz sobe um coturn com o mesmo segredo.

## Observabilidade (SigNoz)

`npm run start:prod` sobe com OpenTelemetry auto-instrumentado (HTTP, Nest, Socket.IO) e exporta traces e métricas via OTLP.

```bash
cp .env.example .env   # ajuste OTEL_EXPORTER_OTLP_ENDPOINT
npm run build && npm run start:prod
```

SigNoz local (precisa de Docker):

```bash
git clone -b main https://github.com/SigNoz/signoz.git && cd signoz/deploy/docker
docker compose up -d   # UI em http://localhost:8080, OTLP em :4318
```

Para desligar: `OTEL_SDK_DISABLED=true`. Logs do Nest (console) não são exportados.
