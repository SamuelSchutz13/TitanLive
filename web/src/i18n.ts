const pt = {
  language: 'Idioma',
  toLight: 'Tema claro',
  toDark: 'Tema escuro',
  homeTitle: 'Assista junto. Converse ao vivo.',
  homeSub: 'Compartilhe sua tela e fale por voz com até 10 pessoas, direto do navegador. Crie uma sala em segundos e é só mandar o link.',
  nameLabel: 'Seu apelido',
  createTitle: 'Criar sala',
  createText: 'Gera um link aleatório. Só entra quem receber o link.',
  createBtn: 'Criar sala',
  joinTitle: 'Entrar numa sala',
  codeLabel: 'Código ou link da sala',
  joinBtn: 'Entrar',
  roomTitle: 'Sala {code}',
  roomMeta: '{n} de 10 na sala',
  copyLink: 'Copiar link',
  copied: 'Link copiado',
  micOn: 'Silenciar',
  micOff: 'Ativar microfone',
  share: 'Compartilhar tela',
  stopShare: 'Parar de compartilhar',
  record: 'Gravar áudio',
  stopRecord: 'Parar e enviar áudio',
  recording: 'Gravando… {time}',
  leave: 'Sair',
  people: 'Na sala',
  you: 'você',
  muted: 'mudo',
  sharing: 'compartilhando',
  stageEmpty: 'Ninguém está compartilhando a tela agora.',
  stageLabel: 'Tela de {name}',
  chat: 'Chat',
  chatEmpty: 'Mensagens somem quando você sai da sala.',
  msgLabel: 'Mensagem',
  send: 'Enviar',
  attach: 'Enviar imagem, vídeo ou áudio',
  connecting: 'Conectando…',
  reconnecting: 'Conexão caiu, reconectando…',
  'err-disconnected': 'Conexão com o servidor perdida. Entre de novo.',
  'err-invalid-room': 'Código de sala inválido.',
  'err-invalid-name': 'Escolha um apelido de até 32 caracteres.',
  'err-room-full': 'Essa sala já está cheia (10 pessoas).',
  'err-already-joined': 'Você já está numa sala.',
  'err-share': 'Não foi possível compartilhar a tela.',
  'err-mic': 'Não foi possível acessar o microfone. Verifique a permissão do navegador.',
  'err-rate-limited': 'Calma! Espere alguns segundos para mandar mais mensagens.',
  'err-invalid-file': 'Só dá para enviar imagem, vídeo ou áudio.',
  'err-file-too-big': 'Arquivo grande demais (máximo 8 MB).',
  'err-record': 'Não foi possível gravar. Verifique a permissão do microfone.',
  'err-unknown': 'Algo deu errado. Tente de novo.',
};

type Dict = typeof pt;

const en: Dict = {
  language: 'Language',
  toLight: 'Light theme',
  toDark: 'Dark theme',
  homeTitle: 'Watch together. Talk live.',
  homeSub: 'Share your screen and talk by voice with up to 10 people, right from your browser. Open a room in seconds and just send the link.',
  nameLabel: 'Your nickname',
  createTitle: 'Create a room',
  createText: 'Makes a random link. Only people with the link can join.',
  createBtn: 'Create room',
  joinTitle: 'Join a room',
  codeLabel: 'Room code or link',
  joinBtn: 'Join',
  roomTitle: 'Room {code}',
  roomMeta: '{n} of 10 in the room',
  copyLink: 'Copy link',
  copied: 'Link copied',
  micOn: 'Mute',
  micOff: 'Unmute',
  share: 'Share screen',
  stopShare: 'Stop sharing',
  record: 'Record audio',
  stopRecord: 'Stop and send audio',
  recording: 'Recording… {time}',
  leave: 'Leave',
  people: 'In the room',
  you: 'you',
  muted: 'muted',
  sharing: 'sharing',
  stageEmpty: 'Nobody is sharing their screen right now.',
  stageLabel: "{name}'s screen",
  chat: 'Chat',
  chatEmpty: 'Messages disappear when you leave the room.',
  msgLabel: 'Message',
  send: 'Send',
  attach: 'Send an image, video or audio',
  connecting: 'Connecting…',
  reconnecting: 'Connection dropped, reconnecting…',
  'err-disconnected': 'Lost connection to the server. Join again.',
  'err-invalid-room': 'Invalid room code.',
  'err-invalid-name': 'Pick a nickname of up to 32 characters.',
  'err-room-full': 'This room is full (10 people).',
  'err-already-joined': 'You are already in a room.',
  'err-share': 'Could not share your screen.',
  'err-mic': 'Could not access the microphone. Check the browser permission.',
  'err-rate-limited': 'Slow down! Wait a few seconds before sending more messages.',
  'err-invalid-file': 'You can only send images, videos or audio.',
  'err-file-too-big': 'File too large (8 MB max).',
  'err-record': 'Could not record. Check the microphone permission.',
  'err-unknown': 'Something went wrong. Try again.',
};

const es: Dict = {
  language: 'Idioma',
  toLight: 'Tema claro',
  toDark: 'Tema oscuro',
  homeTitle: 'Miren juntos. Hablen en vivo.',
  homeSub: 'Comparte tu pantalla y habla por voz con hasta 10 personas, directo desde el navegador. Crea una sala en segundos y solo envía el enlace.',
  nameLabel: 'Tu apodo',
  createTitle: 'Crear sala',
  createText: 'Genera un enlace aleatorio. Solo entra quien lo reciba.',
  createBtn: 'Crear sala',
  joinTitle: 'Entrar a una sala',
  codeLabel: 'Código o enlace de la sala',
  joinBtn: 'Entrar',
  roomTitle: 'Sala {code}',
  roomMeta: '{n} de 10 en la sala',
  copyLink: 'Copiar enlace',
  copied: 'Enlace copiado',
  micOn: 'Silenciar',
  micOff: 'Activar micrófono',
  share: 'Compartir pantalla',
  stopShare: 'Dejar de compartir',
  record: 'Grabar audio',
  stopRecord: 'Detener y enviar audio',
  recording: 'Grabando… {time}',
  leave: 'Salir',
  people: 'En la sala',
  you: 'tú',
  muted: 'silenciado',
  sharing: 'compartiendo',
  stageEmpty: 'Nadie está compartiendo la pantalla ahora.',
  stageLabel: 'Pantalla de {name}',
  chat: 'Chat',
  chatEmpty: 'Los mensajes desaparecen cuando sales de la sala.',
  msgLabel: 'Mensaje',
  send: 'Enviar',
  attach: 'Enviar imagen, video o audio',
  connecting: 'Conectando…',
  reconnecting: 'Se cayó la conexión, reconectando…',
  'err-disconnected': 'Se perdió la conexión con el servidor. Entra de nuevo.',
  'err-invalid-room': 'Código de sala no válido.',
  'err-invalid-name': 'Elige un apodo de hasta 32 caracteres.',
  'err-room-full': 'Esta sala está llena (10 personas).',
  'err-already-joined': 'Ya estás en una sala.',
  'err-share': 'No se pudo compartir la pantalla.',
  'err-mic': 'No se pudo acceder al micrófono. Revisa el permiso del navegador.',
  'err-rate-limited': '¡Calma! Espera unos segundos para enviar más mensajes.',
  'err-invalid-file': 'Solo puedes enviar imágenes, videos o audio.',
  'err-file-too-big': 'Archivo demasiado grande (máximo 8 MB).',
  'err-record': 'No se pudo grabar. Revisa el permiso del micrófono.',
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
  // Icon-only controls: the name lives in aria-label, shown as a tooltip too.
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const label = t(el.dataset.i18nAria as Key);
    el.setAttribute('aria-label', label);
    el.title = label;
  }
}

export function t(key: Key, vars: Record<string, string | number> = {}) {
  return (dicts[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export function detectLang(saved: string | null): Lang {
  const pick = (saved ?? navigator.language).slice(0, 2);
  return pick in dicts ? (pick as Lang) : 'en';
}
