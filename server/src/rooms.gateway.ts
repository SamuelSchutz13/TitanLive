import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const ROOM_ID = /^[A-Za-z0-9_-]{6,64}$/;
// P2P mesh: whoever shares the screen uploads one stream per viewer.
const MAX_PEERS = 10;
const MAX_NAME = 32;
const MAX_CHAT = 500;

type PeerData = { roomId?: string; name?: string };
type Peer = Socket<any, any, any, PeerData>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// Rooms live only in Socket.IO memory: nothing is stored, no history.
@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? true } })
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
    return { id: socket.id, peers };
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
    const text = str((body as Record<string, unknown> | null)?.text);
    const { roomId, name } = socket.data;
    if (!roomId) return { error: 'not-joined' };
    if (!text || text.length > MAX_CHAT) return { error: 'invalid-text' };
    this.server
      .to(roomId)
      .emit('chat', { from: socket.id, name, text, at: Date.now() });
    return { ok: true };
  }

  handleDisconnect(socket: Peer) {
    if (socket.data.roomId)
      this.server.to(socket.data.roomId).emit('peer-left', { id: socket.id });
  }
}
