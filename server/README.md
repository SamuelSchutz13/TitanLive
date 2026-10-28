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
| `join` | `{ roomId, name }` | `{ id, peers: [{id,name}] }` ou `{ error }` |
| `signal` | `{ to, data }` | `{ ok }` ou `{ error }` |
| `chat` | `{ text }` | `{ ok }` ou `{ error }` |

| Servidor → cliente | Payload |
|---|---|
| `peer-joined` | `{ id, name }` |
| `peer-left` | `{ id }` |
| `signal` | `{ from, data }` |
| `chat` | `{ from, name, text, at }` |

Regras: `roomId` `[A-Za-z0-9_-]{6,64}` (gerado pelo cliente, aleatório = privado), nome até 32, chat até 500 (máx. 5 mensagens a cada 5 s por pessoa), máx. 10 por sala.
Erros: `invalid-room`, `invalid-name`, `already-joined`, `room-full`, `invalid-peer`, `not-joined`, `invalid-text`, `rate-limited`.

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
