import './style.css';
import { detectLang, dicts, getLang, setLang, t, type Key, type Lang } from './i18n';
import { flags, icons } from './icons';
import { hasVideo, MAX_FILE, Room, SERVER_URL, type ChatMessage } from './room';

const ROOM_ID = /^[A-Za-z0-9_-]{6,64}$/;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Per-viewer conveniences only; the page works without storage.
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

let room: Room | null = null;

/* ---------- theme + language ---------- */

const root = document.documentElement;
const themeBtn = $<HTMLButtonElement>('theme');
const langBtn = $<HTMLButtonElement>('lang-btn');
const langMenu = $('lang-menu');

for (const el of document.querySelectorAll<HTMLElement>('[data-icon]')) {
  el.innerHTML = icons[el.dataset.icon as keyof typeof icons];
}
for (const b of langMenu.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  b.insertAdjacentHTML('afterbegin', flags[b.dataset.lang as Lang]);
}

function applyTheme(theme: string) {
  root.dataset.theme = theme;
  // The icon shows the theme you switch to.
  themeBtn.dataset.i18nAria = theme === 'dark' ? 'toLight' : 'toDark';
  themeBtn.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
  setLang(getLang());
}

function applyLang(lang: Lang) {
  langBtn.innerHTML = flags[lang];
  for (const b of langMenu.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    b.setAttribute('aria-current', String(b.dataset.lang === lang));
  }
  setLang(lang);
  if (room) render();
}

themeBtn.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  store.set('theme', next);
  applyTheme(next);
});
langMenu.addEventListener('toggle', (e) => {
  if ((e as ToggleEvent).newState !== 'open') return;
  // Popovers open in the top layer; pin this one under its button, right-aligned.
  const r = langBtn.getBoundingClientRect();
  langMenu.style.top = `${r.bottom + 6}px`;
  langMenu.style.right = `${document.documentElement.clientWidth - r.right}px`;
});
langMenu.addEventListener('click', (e) => {
  const lang = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-lang]')?.dataset.lang as Lang | undefined;
  if (!lang) return;
  store.set('lang', lang);
  applyLang(lang);
  langMenu.hidePopover();
  langBtn.focus();
});

applyTheme(store.get('theme') ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
applyLang(detectLang(store.get('lang')));

/* ---------- home ---------- */

const homeForm = $<HTMLFormElement>('home-form');
const nameInput = $<HTMLInputElement>('name');
const codeInput = $<HTMLInputElement>('code');
const homeError = $('home-error');

nameInput.value = store.get('name') ?? '';

const newRoomId = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

// Accepts a bare code or a full link (…/#code).
const parseCode = (v: string) => v.trim().split('#').pop() ?? '';

function showError(el: HTMLElement, code: string) {
  const key = `err-${code}` as Key;
  el.textContent = t(key in dicts.en ? key : 'err-unknown');
}

homeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  homeError.textContent = '';
  const name = nameInput.value.trim();
  if (!name || name.length > 32) return showError(homeError, 'invalid-name');
  const action = (e.submitter as HTMLButtonElement | null)?.value;
  const roomId = action === 'create' ? newRoomId() : parseCode(codeInput.value);
  if (!ROOM_ID.test(roomId)) return showError(homeError, 'invalid-room');
  store.set('name', name);
  void enterRoom(roomId, name);
});

// Says how full a room is while you type its code, so "full" shows up before you try to join.
const roomStatus = $('room-status');
const joinBtn = $<HTMLButtonElement>('join-btn');
let statusFor = '';
async function checkRoom() {
  const id = parseCode(codeInput.value);
  if (id === statusFor) return;
  statusFor = id;
  roomStatus.textContent = '';
  roomStatus.classList.remove('error');
  joinBtn.disabled = false;
  if (!ROOM_ID.test(id)) return;
  const res = await fetch(`${SERVER_URL}/rooms/${id}`).then((r) => r.json() as Promise<{ count: number; max: number }>).catch(() => null);
  if (!res || id !== statusFor || !res.count) return;
  const full = res.count >= res.max;
  roomStatus.textContent = full ? t('err-room-full') : t('roomMeta', { n: res.count });
  roomStatus.classList.toggle('error', full);
  joinBtn.disabled = full;
}
let checkTimer = 0;
codeInput.addEventListener('input', () => {
  clearTimeout(checkTimer);
  checkTimer = window.setTimeout(checkRoom, 300);
});

/* ---------- room ---------- */

const messages: ChatMessage[] = [];
const people = $<HTMLUListElement>('people');
const stageVideo = $<HTMLVideoElement>('stage-video');
const audioBox = $('audio');
const roomError = $('room-error');
const micBtn = $<HTMLButtonElement>('mic');
const shareBtn = $<HTMLButtonElement>('share');

function show(screen: 'home' | 'room') {
  $('home').hidden = screen !== 'home';
  $('room').hidden = screen !== 'room';
}

async function enterRoom(roomId: string, name: string) {
  const r = new Room(roomId, name);
  room = r;
  messages.length = 0;
  r.onChange = render;
  r.onChat = (m) => {
    messages.push(m);
    renderChat();
  };
  r.onError = (code) => showError(roomError, code);
  r.onPresence = chime;
  roomError.textContent = '';
  location.hash = roomId;
  show('room');
  render();
  try {
    await r.join();
    speaking.start();
    render();
  } catch (e) {
    leaveRoom();
    showError(homeError, (e as Error).message);
  }
}

function leaveRoom() {
  stopRecording(false);
  room?.leave();
  for (const { url } of media.values()) URL.revokeObjectURL(url);
  media.clear();
  room = null;
  speaking.stop();
  audioBox.replaceChildren();
  stageVideo.srcObject = null;
  history.replaceState(null, '', location.pathname);
  show('home');
}

$('leave').addEventListener('click', leaveRoom);
micBtn.addEventListener('click', async () => {
  if (!room) return;
  if (room.mic) return room.setMuted(!room.muted);
  roomError.textContent = '';
  await room.enableMic().catch(() => showError(roomError, 'mic'));
});
shareBtn.addEventListener('click', async () => {
  if (!room) return;
  if (room.screen) return room.stopShare();
  roomError.textContent = '';
  // Cancelling the browser's picker is not an error.
  await room.startShare().catch((e: Error) => e.name !== 'NotAllowedError' && showError(roomError, 'share'));
});
$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(location.href);
  const label = $('copy-label');
  label.textContent = t('copied');
  setTimeout(() => (label.textContent = t('copyLink')), 1500);
});

const fullBtn = $<HTMLButtonElement>('fullscreen');
fullBtn.hidden = !document.fullscreenEnabled;
function renderFull() {
  const on = !!document.fullscreenElement;
  fullBtn.innerHTML = on ? icons.minimize : icons.maximize;
  fullBtn.dataset.i18nAria = on ? 'exitFullscreen' : 'fullscreen';
  fullBtn.setAttribute('aria-label', t(fullBtn.dataset.i18nAria as Key));
  fullBtn.title = fullBtn.getAttribute('aria-label')!;
}
fullBtn.addEventListener('click', () => void (document.fullscreenElement ? document.exitFullscreen() : $('stage').requestFullscreen()));
document.addEventListener('fullscreenchange', renderFull);
renderFull();

// M toggles the mic, Esc drops a voice note. Never while typing.
document.addEventListener('keydown', (e) => {
  if (!room || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape' && recorder) return stopRecording(false);
  const typing = (e.target as HTMLElement).closest('input, textarea, [contenteditable]');
  if (!typing && e.key.toLowerCase() === 'm') micBtn.click();
});

const chatForm = $<HTMLFormElement>('chat-form');
const msgInput = $<HTMLInputElement>('msg');
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (recorder) return stopRecording(true);
  const text = msgInput.value.trim();
  if (!text || !room) return;
  msgInput.value = '';
  roomError.textContent = '';
  const ack = await room.sendChat(text);
  if (ack.error) {
    msgInput.value = text;
    showError(roomError, ack.error);
  }
});

const fileInput = $<HTMLInputElement>('file');
$('attach').addEventListener('click', () => fileInput.click());
async function sendFile(file: File) {
  if (!room) return;
  roomError.textContent = '';
  if (!/^(image|video|audio)\//.test(file.type)) return showError(roomError, 'invalid-file');
  if (file.size > MAX_FILE) return showError(roomError, 'file-too-big');
  const ack = await room.sendFile(file);
  if (ack.error) showError(roomError, ack.error);
}
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void sendFile(file);
});

// Opus at browser defaults stays well under the 8 MB file cap for this long.
const MAX_RECORD_S = 5 * 60;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Voice notes: the mic starts recording, then send confirms and the trash discards.
// A separate mic stream so muting the call doesn't silence it.
const recordBtn = $<HTMLButtonElement>('record');
const recTime = $('rec-time');
let recorder: MediaRecorder | null = null;
let recordTimer = 0;
function stopRecording(send: boolean) {
  if (!recorder) return;
  const r = recorder;
  recorder = null;
  clearInterval(recordTimer);
  if (!send) r.ondataavailable = null;
  r.stop();
  r.stream.getTracks().forEach((tr) => tr.stop());
  chatForm.classList.remove('is-recording');
}
recordBtn.addEventListener('click', async () => {
  roomError.textContent = '';
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
  if (!stream) return showError(roomError, 'record');
  const r = new MediaRecorder(stream);
  r.ondataavailable = (e) => {
    // The server accepts a bare MIME type, so drop the ";codecs=…" part.
    const type = (r.mimeType || 'audio/webm').split(';')[0];
    void sendFile(new File([e.data], `voice.${type.split('/')[1]}`, { type }));
  };
  const started = Date.now();
  recTime.textContent = `${clock(0)} / ${clock(MAX_RECORD_S)}`;
  recordTimer = window.setInterval(() => {
    const s = (Date.now() - started) / 1000;
    recTime.textContent = `${clock(s)} / ${clock(MAX_RECORD_S)}`;
    if (s >= MAX_RECORD_S) stopRecording(true);
  }, 250);
  recorder = r;
  r.start();
  chatForm.classList.add('is-recording');
});
$('rec-cancel').addEventListener('click', () => stopRecording(false));

const lightbox = $<HTMLDialogElement>('lightbox');
function openLightbox(src: string) {
  lightbox.querySelector('img')!.src = src;
  lightbox.showModal();
}
// Any click closes it: on the image or the backdrop.
lightbox.addEventListener('click', () => lightbox.close());

// Our own audio player: play/pause, a seekable bar and the time, in the chat's look.
function audioPlayer(src: string) {
  const audio = new Audio(src);
  audio.preload = 'metadata';
  const box = document.createElement('div');
  box.className = 'player';
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'icon-btn play';
  const bar = document.createElement('div');
  bar.className = 'bar';
  const fill = document.createElement('div');
  fill.className = 'fill';
  bar.append(fill);
  const time = document.createElement('span');
  time.className = 'time';
  box.append(play, bar, time, audio);
  const update = () => {
    const d = Number.isFinite(audio.duration) ? audio.duration : 0;
    fill.style.width = d ? `${(audio.currentTime / d) * 100}%` : '0';
    // Round the total up so a 0.9 s note reads 0:01, not 0:00.
    time.textContent = clock(audio.paused && !audio.currentTime ? Math.ceil(d) : audio.currentTime);
    play.innerHTML = audio.paused ? icons.play : icons.pause;
    play.setAttribute('aria-label', t(audio.paused ? 'play' : 'pause'));
  };
  // MediaRecorder webm has no duration until the end is read: seek far once to learn it.
  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration !== Infinity) return update();
    audio.currentTime = 1e9;
    audio.addEventListener('timeupdate', () => ((audio.currentTime = 0), update()), { once: true });
  });
  for (const ev of ['timeupdate', 'play', 'pause', 'ended', 'durationchange']) audio.addEventListener(ev, update);
  play.addEventListener('click', () => void (audio.paused ? audio.play() : audio.pause()));
  bar.addEventListener('click', (e) => {
    const r = bar.getBoundingClientRect();
    if (Number.isFinite(audio.duration)) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });
  update();
  return box;
}

// Built once per message so a playing video or audio survives re-renders.
const media = new Map<ChatMessage, { el: HTMLElement; url: string }>();
function mediaFor(m: ChatMessage, file: NonNullable<ChatMessage['file']>) {
  let entry = media.get(m);
  if (!entry) {
    const url = URL.createObjectURL(new Blob([file.data], { type: file.type }));
    const kind = file.type.split('/')[0];
    let el: HTMLElement;
    if (kind === 'audio') el = audioPlayer(url);
    else {
      const v = kind === 'image' ? new Image() : document.createElement('video');
      if (v instanceof HTMLImageElement) v.addEventListener('click', () => openLightbox(url));
      if (v instanceof HTMLVideoElement) v.controls = true;
      v.src = url;
      el = v;
    }
    el.classList.add('msg-media');
    entry = { el, url };
    media.set(m, entry);
  }
  return entry.el;
}

const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// Same initial and tint for a person in the list and in the chat.
function avatarFor(hueKey: string, name: string) {
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.style.setProperty('--h', String(hue(hueKey)));
  avatar.textContent = name.slice(0, 1).toUpperCase();
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

type Tag = 'you' | 'muted' | 'sharing';
const tagIcon: Partial<Record<Tag, string>> = { muted: icons.micOff, sharing: icons.screen };

function personRow(id: string, name: string, tags: Tag[], hueKey = id) {
  const li = document.createElement('li');
  li.dataset.id = id;
  const avatar = avatarFor(hueKey, name);
  const label = document.createElement('span');
  label.className = 'who';
  label.textContent = name;
  const pills = document.createElement('span');
  pills.className = 'pills';
  for (const tag of tags) {
    const pill = document.createElement('span');
    pill.className = `pill pill-${tag}`;
    pill.innerHTML = tagIcon[tag] ?? '';
    pill.append(t(tag));
    pills.append(pill);
  }
  if (tags.length) label.append(pills);
  li.append(avatar, label);
  return li;
}

function render() {
  const r = room;
  if (!r) return;
  $('room-title').textContent = t('roomTitle', { code: r.roomId.slice(0, 6) });
  const meta = $('room-meta');
  const n = r.peers.size + 1;
  if (r.reconnecting) meta.textContent = t('reconnecting');
  else {
    // Who is in the room at a glance: their avatars, then the count.
    const stack = document.createElement('span');
    stack.className = 'stack';
    stack.setAttribute('aria-hidden', 'true');
    stack.append(avatarFor(r.myId, r.name), ...[...r.peers.values()].map((p) => avatarFor(p.id, p.name)));
    const count = document.createElement('span');
    count.className = 'count';
    count.setAttribute('aria-hidden', 'true');
    count.textContent = `${n}/10`;
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = t('roomMeta', { n });
    meta.replaceChildren(stack, count, label);
  }

  // Icon shows the current state; the label says what a click does.
  const micLive = !!r.mic && !r.muted;
  micBtn.innerHTML = micLive ? icons.mic : icons.micOff;
  micBtn.classList.toggle('is-off', !micLive);
  micBtn.dataset.i18nAria = micLive ? 'micOn' : 'micOff';
  micBtn.setAttribute('aria-label', t(micBtn.dataset.i18nAria as Key));
  micBtn.title = `${micBtn.getAttribute('aria-label')!} (M)`;
  shareBtn.classList.toggle('is-on', !!r.screen);
  shareBtn.dataset.i18nAria = r.screen ? 'stopShare' : 'share';
  shareBtn.setAttribute('aria-label', t(shareBtn.dataset.i18nAria as Key));
  shareBtn.title = shareBtn.getAttribute('aria-label')!;

  const remoteScreens = [...r.peers.values()].flatMap((p) =>
    [...p.streams.values()].filter(hasVideo).map((s) => ({ peer: p, stream: s })),
  );

  const me: Tag[] = ['you'];
  if (!micLive) me.push('muted');
  if (r.screen) me.push('sharing');
  const rows = [personRow('me', r.name, me, r.myId)];
  for (const p of r.peers.values()) {
    const tags: Tag[] = [];
    if (p.muted) tags.push('muted');
    if (remoteScreens.some((s) => s.peer === p)) tags.push('sharing');
    rows.push(personRow(p.id, p.name, tags));
  }
  people.replaceChildren(...rows);

  // One <audio> per remote stream; the stage video stays muted so nothing plays twice.
  const live = new Set<string>();
  for (const p of r.peers.values()) {
    for (const s of p.streams.values()) {
      live.add(s.id);
      if (!audioBox.querySelector(`[data-stream="${s.id}"]`)) {
        const a = new Audio();
        a.dataset.stream = s.id;
        a.srcObject = s;
        a.autoplay = true;
        audioBox.append(a);
      }
      if (!hasVideo(s)) speaking.watch(p.id, s);
    }
  }
  for (const a of audioBox.querySelectorAll<HTMLAudioElement>('audio')) {
    if (!live.has(a.dataset.stream!)) a.remove();
  }
  if (r.mic) speaking.watch('me', r.mic);
  speaking.prune(new Set(['me', ...r.peers.keys()]));

  const stage = r.screen ? { name: r.name, stream: r.screen } : remoteScreens[0] && { name: remoteScreens[0].peer.name, stream: remoteScreens[0].stream };
  if (stageVideo.srcObject !== (stage?.stream ?? null)) stageVideo.srcObject = stage?.stream ?? null;
  $('stage').classList.toggle('is-live', !!stage);
  $('stage-label').textContent = stage ? t('stageLabel', { name: stage.name }) : '';
  renderChat();
}

const timeFmt = () => new Intl.DateTimeFormat(getLang(), { hour: '2-digit', minute: '2-digit' });

function renderChat() {
  const list = $('messages');
  const fmt = timeFmt();
  list.replaceChildren(
    ...messages.map((m) => {
      const li = document.createElement('li');
      const head = document.createElement('p');
      head.className = 'msg-head';
      const who = document.createElement('strong');
      who.textContent = m.name;
      const time = document.createElement('time');
      time.dateTime = new Date(m.at).toISOString();
      time.textContent = fmt.format(m.at);
      head.append(who, time);
      const content = document.createElement('div');
      content.append(head);
      if (m.text) {
        const body = document.createElement('p');
        body.textContent = m.text;
        content.append(body);
      }
      if (m.file) content.append(mediaFor(m, m.file));
      li.append(avatarFor(m.from, m.name), content);
      return li;
    }),
  );
  $('chat-empty').hidden = messages.length > 0;
  list.scrollTop = list.scrollHeight;
}

/* ---------- join / leave chime ---------- */

let chimeCtx: AudioContext | null = null;
// Two short notes: rising when someone joins, falling when someone leaves.
function chime(kind: 'join' | 'leave') {
  chimeCtx ??= new AudioContext();
  const ctx = chimeCtx;
  const notes = kind === 'join' ? [660, 880] : [880, 660];
  notes.forEach((freq, i) => {
    const at = ctx.currentTime + i * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.2);
  });
}

/* ---------- who is speaking ---------- */

const stageSpeaking = $('stage-speaking');
const stageSpeakingNames = $('stage-speaking-names');
$('stage-speaking-icon').innerHTML = icons.mic;

const speaking = (() => {
  let ctx: AudioContext | null = null;
  let timer = 0;
  const meters = new Map<string, { streamId: string; analyser: AnalyserNode }>();
  const buf = new Uint8Array(512);
  return {
    start() {
      ctx ??= new AudioContext();
      void ctx.resume();
      timer = window.setInterval(() => {
        const names: string[] = [];
        for (const [id, m] of meters) {
          m.analyser.getByteTimeDomainData(buf);
          const peak = buf.reduce((max, v) => Math.max(max, Math.abs(v - 128)), 0);
          const talking = peak > 12 && !(id === 'me' && room?.muted);
          people.querySelector(`[data-id="${id}"]`)?.classList.toggle('speaking', talking);
          if (talking) names.push(id === 'me' ? t('you') : (room?.peers.get(id)?.name ?? ''));
        }
        stageSpeaking.hidden = !names.length;
        stageSpeakingNames.textContent = names.join(', ');
      }, 150);
    },
    watch(id: string, stream: MediaStream) {
      if (!ctx || meters.get(id)?.streamId === stream.id || !stream.getAudioTracks().length) return;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      meters.set(id, { streamId: stream.id, analyser });
    },
    prune(ids: Set<string>) {
      for (const id of meters.keys()) if (!ids.has(id)) meters.delete(id);
    },
    stop() {
      clearInterval(timer);
      meters.clear();
      stageSpeaking.hidden = true;
    },
  };
})();

/* ---------- start ---------- */

const fromHash = parseCode(location.hash);
if (ROOM_ID.test(fromHash)) {
  codeInput.value = fromHash;
  void checkRoom();
  (nameInput.value ? $('join-btn') : nameInput).focus();
}
show('home');
