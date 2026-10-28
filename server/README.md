# TitanLive server

Sinalização WebRTC via Socket.IO. Salas só em memória: sem login, sem histórico.

```bash
npm i
npm run start:dev      # PORT=3000, WEB_ORIGIN=* por padrão
npm run test:e2e
```

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

Regras: `roomId` `[A-Za-z0-9_-]{6,64}` (gerado pelo cliente, aleatório = privado), nome até 32, chat até 500, máx. 10 por sala.
Erros: `invalid-room`, `invalid-name`, `already-joined`, `room-full`, `invalid-peer`, `not-joined`, `invalid-text`.
