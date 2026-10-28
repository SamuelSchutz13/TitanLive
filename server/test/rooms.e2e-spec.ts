import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';

describe('RoomsGateway (e2e)', () => {
  let app: INestApplication;
  let url: string;
  const clients: Socket[] = [];

  const connect = () => {
    const c = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    return c;
  };
  type Ack = { id: string; peers: unknown[]; error?: string };
  const send = (c: Socket, ev: string, body: object) =>
    c.emitWithAck(ev, body) as Promise<Ack>;
  const once = (c: Socket, ev: string) =>
    new Promise<unknown>((r) => c.once(ev, r));

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    await app.listen(0);
    url = await app.getUrl();
  });
  afterEach(() => clients.splice(0).forEach((c) => c.disconnect()));
  afterAll(() => app.close());

  it('joins, relays signals and chat, announces leave', async () => {
    const a = connect();
    const b = connect();
    const first = await send(a, 'join', {
      roomId: 'room-123',
      name: 'Ana',
    });
    expect(first.peers).toEqual([]);

    const joined = once(a, 'peer-joined');
    const second = await send(b, 'join', {
      roomId: 'room-123',
      name: 'Bia',
    });
    expect(second.peers).toEqual([{ id: first.id, name: 'Ana' }]);
    expect(await joined).toEqual({ id: second.id, name: 'Bia' });

    const sig = once(b, 'signal');
    await send(a, 'signal', { to: second.id, data: { sdp: 'x' } });
    expect(await sig).toEqual({ from: first.id, data: { sdp: 'x' } });

    const msg = once(a, 'chat');
    await send(b, 'chat', { text: ' oi ' });
    expect(await msg).toMatchObject({
      from: second.id,
      name: 'Bia',
      text: 'oi',
    });

    const media = once(a, 'chat');
    await send(b, 'chat', {
      file: { type: 'image/png', data: Buffer.from([1, 2, 3]) },
    });
    expect(await media).toMatchObject({ file: { type: 'image/png' } });
    expect(
      await send(b, 'chat', {
        file: { type: 'text/html', data: Buffer.from('x') },
      }),
    ).toEqual({
      error: 'invalid-file',
    });
    expect(
      await send(b, 'chat', {
        file: { type: 'video/mp4', data: Buffer.alloc(8 * 1024 * 1024 + 1) },
      }),
    ).toEqual({ error: 'file-too-big' });

    const left = once(a, 'peer-left');
    b.disconnect();
    expect(await left).toEqual({ id: second.id });
  });

  it('rejects bad input and cross-room signals', async () => {
    const a = connect();
    const b = connect();
    expect(await send(a, 'join', { roomId: 'x', name: 'Ana' })).toEqual({
      error: 'invalid-room',
    });
    expect(await send(a, 'join', { roomId: 'room-aaa', name: ' ' })).toEqual({
      error: 'invalid-name',
    });
    expect(await send(a, 'chat', { text: 'oi' })).toEqual({
      error: 'not-joined',
    });

    await send(a, 'join', { roomId: 'room-aaa', name: 'Ana' });
    const { id } = await send(b, 'join', {
      roomId: 'room-bbb',
      name: 'Bia',
    });
    expect(await send(a, 'join', { roomId: 'room-bbb', name: 'Ana' })).toEqual({
      error: 'already-joined',
    });
    expect(await send(a, 'signal', { to: id, data: 1 })).toEqual({
      error: 'invalid-peer',
    });
  });

  it('caps rooms at 10 peers', async () => {
    for (let i = 0; i < 10; i++) {
      await send(connect(), 'join', {
        roomId: 'room-full',
        name: `p${i}`,
      });
    }
    expect(
      await send(connect(), 'join', {
        roomId: 'room-full',
        name: 'late',
      }),
    ).toEqual({ error: 'room-full' });
  });

  it('rate-limits chat bursts', async () => {
    const a = connect();
    await send(a, 'join', { roomId: 'room-spam', name: 'Ana' });
    for (let i = 0; i < 5; i++) {
      expect(await send(a, 'chat', { text: `m${i}` })).toEqual({ ok: true });
    }
    expect(await send(a, 'chat', { text: 'm5' })).toEqual({
      error: 'rate-limited',
    });
  });
});
