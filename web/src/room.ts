import { io, type Socket } from 'socket.io-client';

const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000';

export interface Peer {
  id: string;
  name: string;
  muted: boolean;
  pc: RTCPeerConnection;
  streams: Map<string, MediaStream>;
  // What each incoming video stream is; the sender tells us before adding its tracks.
  kinds: Map<string, VideoKind>;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingAnswer: boolean;
}

export interface ChatMessage {
  from: string;
  name: string;
  text: string;
  at: number;
  file?: { type: string; data: ArrayBuffer };
}

// Matches the server's cap; bigger payloads would get the socket dropped.
export const MAX_FILE = 8 * 1024 * 1024;

export type VideoKind = 'screen' | 'camera';
type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; kinds?: Record<string, VideoKind> };
// The server hands out STUN plus short-lived TURN credentials when it has TURN configured.
type JoinAck = { id: string; peers: { id: string; name: string; muted: boolean }[]; iceServers: RTCIceServer[] } | { error: string };

export const SERVER_URL = SERVER;
// Asked for explicitly: some browsers default these off for getUserMedia.
const VOICE = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

export const hasVideo = (s: MediaStream) => s.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted);

export class Room {
  readonly peers = new Map<string, Peer>();
  myId = '';
  reconnecting = false;
  private iceServers: RTCIceServer[] = [];
  mic: MediaStream | null = null;
  screen: MediaStream | null = null;
  camera: MediaStream | null = null;
  private socket: Socket;
  // Keyed `${kind}:${peerId}`.
  private videoSenders = new Map<string, RTCRtpSender[]>();
  onReact = (_r: { from: string; name: string; emoji: string }) => {};

  onChange = () => {};
  onChat = (_m: ChatMessage) => {};
  onError = (_code: string) => {};
  onPresence = (_kind: 'join' | 'leave', _name: string) => {};

  readonly roomId: string;
  readonly name: string;

  constructor(roomId: string, name: string) {
    this.roomId = roomId;
    this.name = name;
    this.socket = io(SERVER, { transports: ['websocket'], reconnectionAttempts: 10 });
    this.socket.on('peer-joined', ({ id, name, muted }: { id: string; name: string; muted: boolean }) => {
      this.addPeer(id, name, muted);
      this.onPresence('join', name);
      this.onChange();
    });
    this.socket.on('peer-left', ({ id }: { id: string }) => {
      const left = this.peers.get(id);
      left?.pc.close();
      this.peers.delete(id);
      if (left) this.onPresence('leave', left.name);
      this.onChange();
    });
    this.socket.on('peer-muted', ({ id, muted }: { id: string; muted: boolean }) => {
      const p = this.peers.get(id);
      if (p) p.muted = muted;
      this.onChange();
    });
    this.socket.on('signal', ({ from, data }: { from: string; data: Signal }) => void this.handleSignal(from, data));
    this.socket.on('chat', (m: ChatMessage) => this.onChat(m));
    this.socket.on('react', (r: { from: string; name: string; emoji: string }) => this.onReact(r));
    // A dropped connection rejoins the same room under a new id; peers see us leave and come back.
    this.socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return;
      this.closePeers();
      this.reconnecting = true;
      if (reason === 'io server disconnect') this.socket.connect();
      this.onChange();
    });
    this.socket.io.on('reconnect', () => {
      this.enter()
        .then(() => (this.reconnecting = false))
        .catch((e: Error) => this.onError(e.message))
        .finally(() => this.onChange());
    });
    this.socket.io.on('reconnect_failed', () => this.onError('disconnected'));
  }

  async join() {
    // Mic is optional: without it you still watch and hear.
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: VOICE }).catch(() => null);
    await this.enter();
  }

  private async enter() {
    const ack = (await this.socket
      .timeout(8000)
      .emitWithAck('join', { roomId: this.roomId, name: this.name, muted: this.muted })
      .catch(() => ({ error: 'disconnected' }))) as JoinAck;
    if ('error' in ack) throw new Error(ack.error);
    this.myId = ack.id;
    this.iceServers = ack.iceServers;
    for (const p of ack.peers) this.addPeer(p.id, p.name, p.muted);
    this.onChange();
  }

  // For people who joined without a mic (denied or none): ask again and add it to the live call.
  async enableMic() {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: VOICE });
    this.mic = mic;
    for (const p of this.peers.values()) mic.getTracks().forEach((t) => p.pc.addTrack(t, mic));
    this.socket.emit('mute', { muted: false });
    this.onChange();
  }

  setMuted(muted: boolean) {
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.socket.emit('mute', { muted: this.muted });
    this.onChange();
  }

  get muted() {
    return !this.mic?.getAudioTracks().some((t) => t.enabled);
  }

  async startShare() {
    // Chrome hides this tab from the picker: sharing TitanLive inside TitanLive only makes a mirror.
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, selfBrowserSurface: 'exclude' } as DisplayMediaStreamOptions);
    this.screen = screen;
    // Browser's own "stop sharing" bar ends the track.
    screen.getVideoTracks()[0].addEventListener('ended', () => this.stopShare());
    for (const peer of this.peers.values()) this.addVideo(peer, 'screen');
    this.onChange();
  }

  stopShare() {
    this.stopVideo('screen');
  }

  async startCamera() {
    this.camera = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
    for (const peer of this.peers.values()) this.addVideo(peer, 'camera');
    this.onChange();
  }

  stopCamera() {
    this.stopVideo('camera');
  }

  private stopVideo(kind: VideoKind) {
    const stream = this[kind];
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
    this[kind] = null;
    for (const peer of this.peers.values()) {
      this.videoSenders.get(`${kind}:${peer.id}`)?.forEach((s) => peer.pc.removeTrack(s));
      this.videoSenders.delete(`${kind}:${peer.id}`);
    }
    this.onChange();
  }

  // Music mode turns the browser's voice processing off so instruments aren't squashed.
  // Kept here: getSettings() doesn't reliably reflect these constraints in every browser.
  voiceProcessing = true;
  async setVoiceProcessing(on: boolean) {
    await this.mic?.getAudioTracks()[0]?.applyConstraints({ echoCancellation: on, noiseSuppression: on, autoGainControl: on });
    this.voiceProcessing = on;
    this.onChange();
  }

  react(emoji: string) {
    return this.socket.emitWithAck('react', { emoji }) as Promise<{ ok?: true; error?: string }>;
  }

  sendChat(text: string) {
    return this.socket.emitWithAck('chat', { text }) as Promise<{ ok?: true; error?: string }>;
  }

  async sendFile(file: File) {
    const data = await file.arrayBuffer();
    return this.socket.emitWithAck('chat', { file: { type: file.type, data } }) as Promise<{ ok?: true; error?: string }>;
  }

  leave() {
    this.stopShare();
    this.stopCamera();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.closePeers();
    this.socket.disconnect();
  }

  private closePeers() {
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
    this.videoSenders.clear();
  }

  private send(to: string, data: Signal) {
    this.socket.emit('signal', { to, data });
  }

  private addVideo(peer: Peer, kind: VideoKind) {
    const stream = this[kind];
    if (!stream) return;
    this.send(peer.id, { kinds: { [stream.id]: kind } });
    this.videoSenders.set(
      `${kind}:${peer.id}`,
      stream.getTracks().map((t) => peer.pc.addTrack(t, stream)),
    );
  }

  // Both sides create the connection; adding tracks triggers negotiation (perfect negotiation pattern).
  private addPeer(id: string, name: string, muted: boolean) {
    if (this.peers.has(id)) return this.peers.get(id)!;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = { id, name, muted, pc, streams: new Map(), kinds: new Map(), polite: this.myId < id, makingOffer: false, ignoreOffer: false, settingAnswer: false };
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
    pc.oniceconnectionstatechange = () => pc.iceConnectionState === 'failed' && pc.restartIce();
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
    this.addVideo(peer, 'screen');
    this.addVideo(peer, 'camera');
    return peer;
  }

  private async handleSignal(from: string, { description, candidate, kinds }: Signal) {
    const peer = this.peers.get(from);
    if (!peer) return;
    if (kinds) {
      for (const [id, kind] of Object.entries(kinds)) if (kind === 'camera' || kind === 'screen') peer.kinds.set(id, kind);
      return this.onChange();
    }
    const { pc } = peer;
    try {
      if (description) {
        // An offer that lands while our answer is still being applied is not a collision (spec's isSettingRemoteAnswerPending).
        const ready = !peer.makingOffer && (pc.signalingState === 'stable' || peer.settingAnswer);
        const collision = description.type === 'offer' && !ready;
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        peer.settingAnswer = description.type === 'answer';
        await pc.setRemoteDescription(description).finally(() => (peer.settingAnswer = false));
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
