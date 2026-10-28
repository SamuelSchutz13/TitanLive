import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Swagger only covers HTTP; the realtime protocol is Socket.IO, summarized here.
const SOCKET_EVENTS = `
**Socket.IO** (mesma porta). Cliente → servidor (com ack): \`join {roomId, name, muted?}\`, \`mute {muted}\`, \`react {emoji}\`, \`signal {to, data}\`, \`chat {text} | {file: {type, data}}\`.
Servidor → cliente: \`peer-joined {id, name, muted}\`, \`peer-muted {id, muted}\`, \`react {from, name, emoji}\`, \`peer-left {id}\`, \`signal {from, data}\`, \`chat {from, name, text, at, file?}\`.
Detalhes e erros em server/README.md.`;

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('TitanLive')
    .setDescription(SOCKET_EVENTS)
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
