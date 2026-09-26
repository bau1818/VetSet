export const money = (n: number, cents = false) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 });

export const miles = (m: number) => `${m < 10 ? m.toFixed(1) : Math.round(m)} mi`;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

export const phoneHref = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`;
export const smsHref = (p: string, body = '') => `sms:${p.replace(/[^\d+]/g, '')}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;
export const mailHref = (e: string, subject = '', body = '') =>
  `mailto:${e}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
