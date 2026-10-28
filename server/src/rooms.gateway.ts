import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { iceServers } from './ice';

const ROOM_ID = /^[A-Za-z0-9_-]{6,64}$/;
// shortcut: P2P mesh, the sharer uploads one stream per viewer; move to an SFU (mediasoup/LiveKit) for bigger rooms.
const MAX_PEERS = 10;
const MAX_NAME = 32;
const MAX_CHAT = 500;
// shortcut: files are relayed through the server in one message; send large media over WebRTC data channels if 8 MB gets tight.
const MAX_FILE = 8 * 1024 * 1024;
const MEDIA = /^(image|video|audio)\/[\w.+-]+$/;
// Sliding window per socket: at most CHAT_BURST messages every CHAT_WINDOW_MS.
const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 5000;

type PeerData = { roomId?: string; name?: string; chatAt?: number[] };
type Peer = Socket<any, any, any, PeerData>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// shortcut: rooms live in one process memory (no history by design); add the Socket.IO Redis adapter to run more than one instance.
@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN ?? true },
  maxHttpBufferSize: MAX_FILE + 64 * 1024,
})
export class RoomsGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server<any, any, any, PeerData>;

  @SubscribeMessage('join')
  join(@ConnectedSocket() socket: Peer, @MessageBody() body: unknown) {
    const { roomId, name } = (body ?? {}) as Record<string, unknown>;
    const nick = str(name);
    if (socket.data.roomId) return { error: 'already-joined' };
    if (typeof roomId !== 'string' || !ROOM_ID.test(roomId))
      return { error: 'invalid-room' };
    if (!nick || nick.length > MAX_NAME) return { error: 'invalid-name' };

    const ids = [...(this.server.sockets.adapter.rooms.get(roomId) ?? [])];
    if (ids.length >= MAX_PEERS) return { error: 'room-full' };

    const peers = ids.map((id) => ({
      id,
      name: this.server.sockets.sockets.get(id)?.data.name,
    }));
    socket.data = { roomId, name: nick };
    void socket.join(roomId);
    socket.to(roomId).emit('peer-joined', { id: socket.id, name: nick });
    return { id: socket.id, peers, iceServers: iceServers() };
  }

  // Relays WebRTC offer/answer/ICE, only between peers of the same room.
  @SubscribeMessage('signal')
  signal(@ConnectedSocket() socket: Peer, @MessageBody() body: unknown) {
    const { to, data } = (body ?? {}) as Record<string, unknown>;
    const target =
      typeof to === 'string' ? this.server.sockets.sockets.get(to) : undefined;
    if (!socket.data.roomId || target?.data.roomId !== socket.data.roomId)
      return { error: 'invalid-peer' };
    target.emit('signal', { from: socket.id, data });
    return { ok: true };
  }

  @SubscribeMessage('chat')
  chat(@ConnectedSocket() socket: Peer, @MessageBody() body: unknown) {
    const { text: rawText, file: rawFile } = (body ?? {}) as Record<
      string,
      unknown
    >;
    const text = str(rawText);
    const { roomId, name } = socket.data;
    if (!roomId) return { error: 'not-joined' };
    const file = rawFile as { type?: unknown; data?: unknown } | undefined;
    if (file) {
      if (
        typeof file.type !== 'string' ||
        !MEDIA.test(file.type) ||
        !Buffer.isBuffer(file.data)
      )
        return { error: 'invalid-file' };
      if (file.data.length > MAX_FILE) return { error: 'file-too-big' };
    } else if (!text || text.length > MAX_CHAT)
      return { error: 'invalid-text' };
    const now = Date.now();
    const recent = (socket.data.chatAt ?? []).filter(
      (t) => now - t < CHAT_WINDOW_MS,
    );
    if (recent.length >= CHAT_BURST) return { error: 'rate-limited' };
    socket.data.chatAt = [...recent, now];
    this.server.to(roomId).emit('chat', {
      from: socket.id,
      name,
      text,
      at: now,
      ...(file && { file: { type: file.type, data: file.data } }),
    });
    return { ok: true };
  }

  handleDisconnect(socket: Peer) {
    if (socket.data.roomId)
      this.server.to(socket.data.roomId).emit('peer-left', { id: socket.id });
  }
}
