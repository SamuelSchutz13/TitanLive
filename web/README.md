# TitanLive web

Vite + TypeScript, sem framework. Duas telas: início (apelido, criar ou entrar) e sala (tela compartilhada, quem está na sala com indicador de voz, chat sem histórico). Tema claro/escuro e idiomas pt/en/es.

```bash
npm i
npm run dev          # http://localhost:5173, servidor em VITE_SERVER_URL (padrão http://localhost:3000)
npm run test:e2e     # Playwright: sobe server + web e testa 2 navegadores reais via WebRTC
```

Primeira vez com Playwright: `npx playwright install chromium`.

- `src/room.ts` — Socket.IO + WebRTC (malha P2P, perfect negotiation)
- `src/i18n.ts` — textos pt/en/es
- `src/main.ts` — telas, tema, idioma, indicador de quem fala
