import './style.css';
import { detectLang, dicts, getLang, setLang, t, type Key, type Lang } from './i18n';
import { flags, icons } from './icons';
import { hasVideo, Room, type ChatMessage } from './room';

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
  room?.leave();
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
  const btn = $('copy');
  btn.textContent = t('copied');
  setTimeout(() => (btn.textContent = t('copyLink')), 1500);
});

const chatForm = $<HTMLFormElement>('chat-form');
const msgInput = $<HTMLInputElement>('msg');
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
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

function personRow(id: string, name: string, meta: string[], hueKey = id) {
  const li = document.createElement('li');
  li.dataset.id = id;
  const avatar = avatarFor(hueKey, name);
  const label = document.createElement('span');
  label.className = 'who';
  label.textContent = name;
  const sub = document.createElement('span');
  sub.className = 'meta';
  sub.textContent = meta.join(' · ');
  label.append(sub);
  li.append(avatar, label);
  return li;
}

function render() {
  const r = room;
  if (!r) return;
  $('room-title').textContent = t('roomTitle', { code: r.roomId.slice(0, 6) });
  $('room-meta').textContent = r.reconnecting ? t('reconnecting') : t('roomMeta', { n: r.peers.size + 1 });

  // Icon shows the current state; the label says what a click does.
  const micLive = !!r.mic && !r.muted;
  micBtn.innerHTML = micLive ? icons.mic : icons.micOff;
  micBtn.classList.toggle('is-off', !micLive);
  micBtn.dataset.i18nAria = micLive ? 'micOn' : 'micOff';
  micBtn.setAttribute('aria-label', t(micBtn.dataset.i18nAria as Key));
  micBtn.title = micBtn.getAttribute('aria-label')!;
  shareBtn.textContent = r.screen ? t('stopShare') : t('share');

  const remoteScreens = [...r.peers.values()].flatMap((p) =>
    [...p.streams.values()].filter(hasVideo).map((s) => ({ peer: p, stream: s })),
  );

  const me = [t('you')];
  if (!micLive) me.push(t('muted'));
  if (r.screen) me.push(t('sharing'));
  const rows = [personRow('me', r.name, me, r.myId)];
  for (const p of r.peers.values()) {
    rows.push(personRow(p.id, p.name, remoteScreens.some((s) => s.peer === p) ? [t('sharing')] : []));
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
      const body = document.createElement('p');
      body.textContent = m.text;
      const content = document.createElement('div');
      content.append(head, body);
      li.append(avatarFor(m.from, m.name), content);
      return li;
    }),
  );
  $('chat-empty').hidden = messages.length > 0;
  list.scrollTop = list.scrollHeight;
}

/* ---------- who is speaking ---------- */

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
        for (const [id, m] of meters) {
          m.analyser.getByteTimeDomainData(buf);
          const peak = buf.reduce((max, v) => Math.max(max, Math.abs(v - 128)), 0);
          people.querySelector(`[data-id="${id}"]`)?.classList.toggle('speaking', peak > 12);
        }
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
    },
  };
})();

/* ---------- start ---------- */

const fromHash = parseCode(location.hash);
if (ROOM_ID.test(fromHash)) {
  codeInput.value = fromHash;
  (nameInput.value ? $('join-btn') : nameInput).focus();
}
show('home');
