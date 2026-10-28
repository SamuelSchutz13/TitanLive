const pt = {
  language: 'Idioma',
  toLight: 'Tema claro',
  toDark: 'Tema escuro',
  homeTitle: 'Salas privadas, sem cadastro',
  homeSub: 'Uma pessoa compartilha a tela e o resto conversa por voz. Nada fica salvo.',
  nameLabel: 'Seu apelido',
  createTitle: 'Criar sala',
  createText: 'Gera um link aleatório. Só entra quem receber o link.',
  createBtn: 'Criar sala',
  joinTitle: 'Entrar numa sala',
  codeLabel: 'Código ou link da sala',
  joinBtn: 'Entrar',
  roomTitle: 'Sala {code}',
  roomMeta: '{n} de 10 na sala · nada é gravado',
  copyLink: 'Copiar link',
  copied: 'Link copiado',
  micOn: 'Silenciar',
  micOff: 'Ativar microfone',
  noMic: 'Sem microfone',
  share: 'Compartilhar tela',
  stopShare: 'Parar de compartilhar',
  leave: 'Sair',
  people: 'Na sala',
  you: 'você',
  muted: 'mudo',
  sharing: 'compartilhando a tela',
  stageEmpty: 'Ninguém está compartilhando a tela agora.',
  stageLabel: 'Tela de {name}',
  chat: 'Chat',
  chatEmpty: 'Mensagens somem quando você sai da sala.',
  msgLabel: 'Mensagem',
  send: 'Enviar',
  connecting: 'Conectando…',
  'err-disconnected': 'Conexão com o servidor perdida. Entre de novo.',
  'err-invalid-room': 'Código de sala inválido.',
  'err-invalid-name': 'Escolha um apelido de até 32 caracteres.',
  'err-room-full': 'Essa sala já está cheia (10 pessoas).',
  'err-already-joined': 'Você já está numa sala.',
  'err-share': 'Não foi possível compartilhar a tela.',
  'err-rate-limited': 'Calma! Espere alguns segundos para mandar mais mensagens.',
  'err-unknown': 'Algo deu errado. Tente de novo.',
};

type Dict = typeof pt;

const en: Dict = {
  language: 'Language',
  toLight: 'Light theme',
  toDark: 'Dark theme',
  homeTitle: 'Private rooms, no sign-up',
  homeSub: 'One person shares their screen, everyone else talks by voice. Nothing is saved.',
  nameLabel: 'Your nickname',
  createTitle: 'Create a room',
  createText: 'Makes a random link. Only people with the link can join.',
  createBtn: 'Create room',
  joinTitle: 'Join a room',
  codeLabel: 'Room code or link',
  joinBtn: 'Join',
  roomTitle: 'Room {code}',
  roomMeta: '{n} of 10 in the room · nothing is recorded',
  copyLink: 'Copy link',
  copied: 'Link copied',
  micOn: 'Mute',
  micOff: 'Unmute',
  noMic: 'No microphone',
  share: 'Share screen',
  stopShare: 'Stop sharing',
  leave: 'Leave',
  people: 'In the room',
  you: 'you',
  muted: 'muted',
  sharing: 'sharing their screen',
  stageEmpty: 'Nobody is sharing their screen right now.',
  stageLabel: "{name}'s screen",
  chat: 'Chat',
  chatEmpty: 'Messages disappear when you leave the room.',
  msgLabel: 'Message',
  send: 'Send',
  connecting: 'Connecting…',
  'err-disconnected': 'Lost connection to the server. Join again.',
  'err-invalid-room': 'Invalid room code.',
  'err-invalid-name': 'Pick a nickname of up to 32 characters.',
  'err-room-full': 'This room is full (10 people).',
  'err-already-joined': 'You are already in a room.',
  'err-share': 'Could not share your screen.',
  'err-rate-limited': 'Slow down! Wait a few seconds before sending more messages.',
  'err-unknown': 'Something went wrong. Try again.',
};

const es: Dict = {
  language: 'Idioma',
  toLight: 'Tema claro',
  toDark: 'Tema oscuro',
  homeTitle: 'Salas privadas, sin registro',
  homeSub: 'Una persona comparte la pantalla y el resto habla por voz. Nada se guarda.',
  nameLabel: 'Tu apodo',
  createTitle: 'Crear sala',
  createText: 'Genera un enlace aleatorio. Solo entra quien lo reciba.',
  createBtn: 'Crear sala',
  joinTitle: 'Entrar a una sala',
  codeLabel: 'Código o enlace de la sala',
  joinBtn: 'Entrar',
  roomTitle: 'Sala {code}',
  roomMeta: '{n} de 10 en la sala · nada se graba',
  copyLink: 'Copiar enlace',
  copied: 'Enlace copiado',
  micOn: 'Silenciar',
  micOff: 'Activar micrófono',
  noMic: 'Sin micrófono',
  share: 'Compartir pantalla',
  stopShare: 'Dejar de compartir',
  leave: 'Salir',
  people: 'En la sala',
  you: 'tú',
  muted: 'silenciado',
  sharing: 'compartiendo pantalla',
  stageEmpty: 'Nadie está compartiendo la pantalla ahora.',
  stageLabel: 'Pantalla de {name}',
  chat: 'Chat',
  chatEmpty: 'Los mensajes desaparecen cuando sales de la sala.',
  msgLabel: 'Mensaje',
  send: 'Enviar',
  connecting: 'Conectando…',
  'err-disconnected': 'Se perdió la conexión con el servidor. Entra de nuevo.',
  'err-invalid-room': 'Código de sala no válido.',
  'err-invalid-name': 'Elige un apodo de hasta 32 caracteres.',
  'err-room-full': 'Esta sala está llena (10 personas).',
  'err-already-joined': 'Ya estás en una sala.',
  'err-share': 'No se pudo compartir la pantalla.',
  'err-rate-limited': '¡Calma! Espera unos segundos para enviar más mensajes.',
  'err-unknown': 'Algo salió mal. Inténtalo de nuevo.',
};

export const dicts = { pt, en, es };
export type Lang = keyof typeof dicts;
export type Key = keyof Dict;

let lang: Lang = 'pt';

export const getLang = () => lang;

export function setLang(next: Lang) {
  lang = next;
  document.documentElement.lang = next === 'pt' ? 'pt-BR' : next;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as Key);
  }
}

export function t(key: Key, vars: Record<string, string | number> = {}) {
  return (dicts[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export function detectLang(saved: string | null): Lang {
  const pick = (saved ?? navigator.language).slice(0, 2);
  return pick in dicts ? (pick as Lang) : 'en';
}
