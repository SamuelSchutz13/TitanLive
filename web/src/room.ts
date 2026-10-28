import { io, type Socket } from 'socket.io-client';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000';
// shortcut: STUN only, peers behind strict NAT (corporate, some 4G) fail; add a TURN server (coturn) before going public.
const ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export interface Peer {
  id: string;
  name: string;
  pc: RTCPeerConnection;
  streams: Map<string, MediaStream>;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

export interface ChatMessage {
  from: string;
  name: string;
  text: string;
  at: number;
}

type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type JoinAck = { id: string; peers: { id: string; name: string }[] } | { error: string };

export const hasVideo = (s: MediaStream) => s.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted);

export class Room {
  readonly peers = new Map<string, Peer>();
  myId = '';
  mic: MediaStream | null = null;
  screen: MediaStream | null = null;
  private socket: Socket;
  private screenSenders = new Map<string, RTCRtpSender[]>();

  onChange = () => {};
  onChat = (_m: ChatMessage) => {};
  onError = (_code: string) => {};

  readonly roomId: string;
  readonly name: string;

  constructor(roomId: string, name: string) {
    this.roomId = roomId;
    this.name = name;
    this.socket = io(SERVER, { transports: ['websocket'], reconnection: false });
    this.socket.on('peer-joined', ({ id, name }: { id: string; name: string }) => {
      this.addPeer(id, name);
      this.onChange();
    });
    this.socket.on('peer-left', ({ id }: { id: string }) => {
      this.peers.get(id)?.pc.close();
      this.peers.delete(id);
      this.onChange();
    });
    this.socket.on('signal', ({ from, data }: { from: string; data: Signal }) => void this.handleSignal(from, data));
    this.socket.on('chat', (m: ChatMessage) => this.onChat(m));
    this.socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') this.onError('disconnected');
    });
    this.socket.on('connect_error', () => this.onError('disconnected'));
  }

  async join() {
    // Mic is optional: without it you still watch and hear.
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    const ack = (await this.socket
      .timeout(8000)
      .emitWithAck('join', { roomId: this.roomId, name: this.name })
      .catch(() => ({ error: 'disconnected' }))) as JoinAck;
    if ('error' in ack) throw new Error(ack.error);
    this.myId = ack.id;
    for (const p of ack.peers) this.addPeer(p.id, p.name);
    this.onChange();
  }

  setMuted(muted: boolean) {
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.onChange();
  }

  get muted() {
    return !this.mic?.getAudioTracks().some((t) => t.enabled);
  }

  async startShare() {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    this.screen = screen;
    // Browser's own "stop sharing" bar ends the track.
    screen.getVideoTracks()[0].addEventListener('ended', () => this.stopShare());
    for (const peer of this.peers.values()) this.addScreen(peer);
    this.onChange();
  }

  stopShare() {
    if (!this.screen) return;
    this.screen.getTracks().forEach((t) => t.stop());
    this.screen = null;
    for (const peer of this.peers.values()) {
      this.screenSenders.get(peer.id)?.forEach((s) => peer.pc.removeTrack(s));
      this.screenSenders.delete(peer.id);
    }
    this.onChange();
  }

  sendChat(text: string) {
    return this.socket.emitWithAck('chat', { text }) as Promise<{ ok?: true; error?: string }>;
  }

  leave() {
    this.stopShare();
    this.mic?.getTracks().forEach((t) => t.stop());
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
    this.socket.disconnect();
  }

  private send(to: string, data: Signal) {
    this.socket.emit('signal', { to, data });
  }

  private addScreen(peer: Peer) {
    if (!this.screen) return;
    const screen = this.screen;
    this.screenSenders.set(
      peer.id,
      screen.getTracks().map((t) => peer.pc.addTrack(t, screen)),
    );
  }

  // Both sides create the connection; adding tracks triggers negotiation (perfect negotiation pattern).
  private addPeer(id: string, name: string) {
    if (this.peers.has(id)) return this.peers.get(id)!;
    const pc = new RTCPeerConnection(ICE);
    const peer: Peer = { id, name, pc, streams: new Map(), polite: this.myId < id, makingOffer: false, ignoreOffer: false };
    this.peers.set(id, peer);

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        this.send(id, { description: pc.localDescription!.toJSON() });
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onicecandidate = ({ candidate }) => candidate && this.send(id, { candidate: candidate.toJSON() });
    pc.ontrack = ({ track, streams: [stream] }) => {
      if (!stream) return;
      peer.streams.set(stream.id, stream);
      const changed = () => {
        if (!stream.getTracks().length) peer.streams.delete(stream.id);
        this.onChange();
      };
      stream.onremovetrack = changed;
      track.onunmute = changed;
      track.onmute = changed;
      this.onChange();
    };

    this.mic?.getTracks().forEach((t) => pc.addTrack(t, this.mic!));
    this.addScreen(peer);
    return peer;
  }

  private async handleSignal(from: string, { description, candidate }: Signal) {
    const peer = this.peers.get(from);
    if (!peer) return;
    const { pc } = peer;
    try {
      if (description) {
        const collision = description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          this.send(from, { description: pc.localDescription!.toJSON() });
        }
      } else if (candidate) {
        await pc.addIceCandidate(candidate).catch((e) => {
          if (!peer.ignoreOffer) throw e;
        });
      }
    } catch (e) {
      console.error('signal', e);
    }
  }
}
