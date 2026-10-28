// Outline icons (24px grid, stroke = currentColor) and flags, as static trusted markup.
const icon = (paths: string) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

export const icons = {
  sun: icon(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  ),
  moon: icon('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
  send: icon('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>'),
};

const flag = (body: string) => `<svg class="flag" viewBox="0 0 20 14" aria-hidden="true">${body}</svg>`;

export const flags = {
  pt: flag(
    '<rect width="20" height="14" fill="#009c3b"/><path d="M10 1.6 18.2 7 10 12.4 1.8 7z" fill="#ffdf00"/><circle cx="10" cy="7" r="3.1" fill="#002776"/>',
  ),
  en: flag(
    '<rect width="20" height="14" fill="#fff"/><path d="M0 0h20v1.08H0zm0 2.15h20v1.08H0zm0 2.15h20v1.08H0zm0 2.15h20v1.08H0zm0 2.15h20v1.08H0zm0 2.15h20v1.08H0zm0 2.15h20v1.08H0z" fill="#b22234"/><rect width="8.5" height="7.54" fill="#3c3b6e"/>',
  ),
  es: flag('<rect width="20" height="14" fill="#aa151b"/><rect y="3.5" width="20" height="7" fill="#f1bf00"/>'),
};
