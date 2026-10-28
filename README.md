# TitanLive

Salas privadas e anônimas para compartilhar tela e conversar por voz, estilo call do Discord. Sem login, sem histórico.

- `server/` — NestJS (sinalização WebRTC via Socket.IO)
- `docker-compose.yml` — coturn (TURN) para quem está atrás de NAT restritivo
- `web/` — Vite + TypeScript (telas, WebRTC, tema claro/escuro, pt/en/es)
