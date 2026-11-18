/* ==========================================================================
   KombiTech — Core helpers (DOM, icons, formatters, UI primitives)
   ========================================================================== */
window.KT = window.KT || {};

(function (K) {
  'use strict';

  /* ---------- DOM ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function h(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html).trim();
    return tpl.content.firstElementChild;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function on(root, event, selector, handler) {
    if (!root) return () => {};
    const listener = (ev) => {
      const target = ev.target.closest(selector);
      if (target && root.contains(target)) handler(ev, target);
    };
    root.addEventListener(event, listener);
    return () => root.removeEventListener(event, listener);
  }

  /* ---------- Icons (Lucide-style, 24x24) ---------- */
  const ICONS = {
    home: 'M3 10.4 12 3l9 7.4V20a1.5 1.5 0 0 1-1.5 1.5H15v-6.2H9v6.2H4.5A1.5 1.5 0 0 1 3 20z',
    users: 'M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21M9 11.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2M22 21v-1.8a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2',
    route: 'M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15M18 5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    map: 'M9 20.5 3 17.6V4.5l6 2.9 6-2.9 6 2.9v13.1l-6-2.9-6 2.9ZM9 7.4v13.1M15 4.5v13.1',
    chart: 'M3 3v18h18M7.5 16.5v-4.2M12 16.5V8M16.5 16.5v-6.6',
    settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1.5 14h5M9.5 8h5M17.5 16h5',
    bell: 'M18 8.4A6 6 0 0 0 6 8.4c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.3-4.3',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
    trash: 'M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6M19 6l-1 13.2a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8L5 6M10 11v6M14 11v6',
    pin: 'M20 10.4c0 6-8 11.6-8 11.6S4 16.4 4 10.4a8 8 0 0 1 16 0Z M15 10.2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z',
    school: 'M22 9.6 12 4 2 9.6l10 5.6 10-5.6ZM6 12v5.4c0 1.7 2.7 3.1 6 3.1s6-1.4 6-3.1V12M22 9.6v5.6',
    van: 'M2.5 16.5V7.8A1.8 1.8 0 0 1 4.3 6h9.3l5 5.1v5.4M14.6 6v5.1H19M5.2 16.5h1.3M11 16.5h3.6M18.6 16.5h2.9M9 16.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0ZM20.4 16.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0Z',
    play: 'M7 4.5v15l12-7.5Z',
    pause: 'M9 5v14M15 5v14',
    stop: 'M6.5 5.5h11A1 1 0 0 1 18.5 6.5v11a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z',
    skip: 'M5 4.5 14 12 5 19.5ZM19 5v14',
    check: 'M20 6 9 17l-5-5',
    checkCircle: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14.1l-3-3',
    x: 'M18 6 6 18M6 6l12 12',
    chevronRight: 'm9 18 6-6-6-6',
    chevronDown: 'm6 9 6 6 6-6',
    chevronUp: 'm18 15-6-6-6 6',
    chevronLeft: 'm15 18-6-6 6-6',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    menu: 'M3 6h18M3 12h18M3 18h18',
    filter: 'M22 3H2l8 9.5V19l4 2v-8.5Z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    shield: 'M12 22s8-4 8-10V5.4L12 2 4 5.4V12c0 6 8 10 8 10Z',
    lock: 'M5.5 11h13a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18.5 22h-13A1.5 1.5 0 0 1 4 20.5v-8A1.5 1.5 0 0 1 5.5 11ZM8 11V7.2a4 4 0 0 1 8 0V11',
    mail: 'M4 4.5h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2ZM22 7l-10 6L2 7',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    eyeOff: 'M17.9 17.9A10.4 10.4 0 0 1 12 19c-6.4 0-10-7-10-7a18.6 18.6 0 0 1 5.1-5.9M9.9 4.2A10.4 10.4 0 0 1 12 4c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2M14.1 14.1a3 3 0 0 1-4.2-4.2M2 2l20 20',
    alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
    info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 16v-4.5M12 8h.01',
    clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6.5V12l3.6 2.1',
    calendar: 'M4.5 4.5h15A1.5 1.5 0 0 1 21 6v14a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20V6a1.5 1.5 0 0 1 1.5-1.5ZM16 2.5v4M8 2.5v4M3 10h18',
    arrowRight: 'M5 12h14M13 5l7 7-7 7',
    arrowUp: 'M12 19V5M5 12l7-7 7 7',
    arrowDown: 'M12 5v14M19 12l-7 7-7-7',
    nav: 'M3 11 22 2l-9 19-2-8-8-2Z',
    locate: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM12 2v3M12 19v3M2 12h3M19 12h3',
    refresh: 'M3 12a9 9 0 0 1 15.1-6.6L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.1 6.6L3 16M3 21v-5h5',
    more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
    key: 'M14.5 9.5a4.5 4.5 0 1 1-4.2 6L4 21H2v-3l6.5-6.5M17 7l3 3M15.5 2.5 21 8',
    database: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3ZM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    zap: 'M13 2 3 14h8l-1 8 10-12h-8l1-8Z',
    building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h3a1 1 0 0 1 1 1v11M2 21h20M8 7h4M8 11h4M8 15h4',
    wifi: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 20h.01',
    copy: 'M9 9h10.5A1.5 1.5 0 0 1 21 10.5V21a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 21V10.5A1.5 1.5 0 0 1 9 9ZM4.5 15H3.5A1.5 1.5 0 0 1 2 13.5V3A1.5 1.5 0 0 1 3.5 1.5H14A1.5 1.5 0 0 1 15.5 3v1',
    external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
    crosshair: 'M12 2v4M12 18v4M2 12h4M18 12h4M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    userCheck: 'M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21M9 11.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2M16 11.5l2 2 4-4',
    userX: 'M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21M9 11.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2M17 8l5 5M22 8l-5 5',
    grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
    bolt: 'M13 2 3 14h8l-1 8 10-12h-8l1-8Z',
    palette: 'M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 10.7C22 5.9 17.5 2 12 2ZM7.5 10.5h.01M11 7h.01M15.5 8.5h.01',
    message: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l2-4.4A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h5',
    printer: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
    power: 'M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0'
  };

  function icon(name, size, cls) {
    const def = ICONS[name];
    if (!def) return '';
    const filled = name === 'play' || name === 'stop' || name === 'zap' || name === 'bolt';
    const attrs = filled
      ? 'fill="currentColor" stroke="none"'
      : 'fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"';
    const dim = size ? ` width="${size}" height="${size}"` : '';
    return `<svg viewBox="0 0 24 24"${dim} ${attrs}${cls ? ` class="${cls}"` : ''} aria-hidden="true">${def.split(' M').map((p, i) => `<path d="${i ? 'M' + p : p}"/>`).join('')}</svg>`;
  }

  /* ---------- Formatters ---------- */
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function toDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtTime(value) {
    const d = toDate(value);
    return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
  }

  function fmtDate(value, opts) {
    const d = toDate(value);
    if (!d) return '—';
    if (opts && opts.long) return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function fmtDateShort(value) {
    const d = toDate(value);
    return d ? `${pad(d.getDate())} ${MONTHS[d.getMonth()]}` : '—';
  }

  function fmtWeekday(value) {
    const d = toDate(value);
    return d ? WEEKDAYS[d.getDay()] : '—';
  }

  function fmtTodayLong(date) {
    const d = toDate(date) || new Date();
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
  }

  function fmtDuration(minutes) {
    const m = Math.max(0, Math.round(Number(minutes) || 0));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h <= 0) return `${r} min`;
    return `${h}h ${pad(r)}min`;
  }

  function fmtKm(km, digits) {
    const n = Number(km) || 0;
    return `${n.toFixed(digits == null ? 1 : digits).replace('.', ',')} km`;
  }

  function fmtDistance(meters) {
    const m = Number(meters) || 0;
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || '';
  }

  function maskPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 6) return phone || '—';
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}****-**${digits.slice(-2)}`;
  }

  function formatPhone(value) {
    const d = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function greeting(date) {
    const hour = (toDate(date) || new Date()).getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  /* ---------- Geo ---------- */
  const R_EARTH = 6371000;
  function haversine(a, b) {
    if (!a || !b) return Infinity;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function pathDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
    return total;
  }

  function interpolate(a, b, t) {
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  }

  function bearing(a, b) {
    const toRad = (v) => (v * Math.PI) / 180;
    const toDeg = (v) => (v * 180) / Math.PI;
    const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
    const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  /* ---------- Misc ---------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), wait || 250);
    };
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  }

  function toCSV(rows, headers) {
    const escCsv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = headers ? headers.map(escCsv).join(';') : '';
    const body = rows.map((r) => r.map(escCsv).join(';')).join('\r\n');
    return '\uFEFF' + (head ? head + '\r\n' : '') + body;
  }

  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  /* Hash de demonstração — em produção use bcrypt/argon2 no servidor. */
  async function hashPassword(password) {
    const input = `kombitech::v1::${password}`;
    try {
      if (window.crypto && window.crypto.subtle && window.isSecureContext !== false) {
        const data = new TextEncoder().encode(input);
        const buf = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* fallback abaixo */ }
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 = (h1 ^ c) * 16777619 >>> 0;
      h2 = (h2 + c * (i + 7)) * 2654435761 >>> 0;
    }
    return 'fb' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  /* ---------- Toast ---------- */
  function toast(title, message, type, opts) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const options = opts || {};
    const kind = type || 'info';
    const iconName = kind === 'success' ? 'checkCircle' : kind === 'error' ? 'alert' : kind === 'warn' ? 'alert' : 'info';
    const node = h(`
      <div class="toast ${kind}" role="status">
        <div class="toast-ico">${icon(iconName)}</div>
        <div class="toast-body">
          <div class="toast-title">${esc(title)}</div>
          ${message ? `<div class="toast-msg">${esc(message)}</div>` : ''}
        </div>
        <button class="icon-btn" aria-label="Fechar">${icon('x')}</button>
      </div>`);
    root.appendChild(node);
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      node.classList.add('out');
      setTimeout(() => node.remove(), 220);
    };
    node.querySelector('.icon-btn').addEventListener('click', remove);
    const ttl = options.ttl || (kind === 'error' ? 6000 : 4400);
    setTimeout(remove, ttl);
    return remove;
  }

  /* ---------- Modal ---------- */
  function modal(opts) {
    const root = document.getElementById('modal-root');
    if (!root) return { close: () => {} };
    const options = opts || {};
    const size = options.size ? `modal-${options.size}` : '';
    const wrap = h(`
      <div class="modal-backdrop" role="presentation">
        <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title-${Date.now()}">
          <div class="modal-head">
            ${options.icon ? `<div class="modal-icon ${options.iconTone || ''}">${icon(options.icon)}</div>` : ''}
            <div class="grow">
              <h3>${esc(options.title || '')}</h3>
              ${options.subtitle ? `<p>${esc(options.subtitle)}</p>` : ''}
            </div>
            <button class="icon-btn" data-modal-close aria-label="Fechar">${icon('x')}</button>
          </div>
          <div class="modal-body ${options.flush ? 'flush' : ''}">${options.body || ''}</div>
          ${options.footer ? `<div class="modal-foot">${options.footer}</div>` : ''}
        </div>
      </div>`);

    root.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    const close = () => {
      wrap.style.animation = 'fadeIn .15s reverse both';
      setTimeout(() => {
        wrap.remove();
        if (!document.querySelector('.modal-backdrop')) document.body.style.overflow = '';
      }, 150);
      document.removeEventListener('keydown', onKey);
    };

    function onKey(ev) {
      if (ev.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', (ev) => {
      if (ev.target === wrap && options.dismissible !== false) close();
    });
    $$('[data-modal-close]', wrap).forEach((btn) => btn.addEventListener('click', close));

    if (typeof options.onMount === 'function') {
      options.onMount(wrap.querySelector('.modal'), close, wrap);
    }
    const firstInput = wrap.querySelector('input:not([type=hidden]), select, textarea');
    if (firstInput && window.innerWidth > 860) setTimeout(() => firstInput.focus(), 60);
    return { close, el: wrap.querySelector('.modal') };
  }

  function confirmDialog(opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      let settled = false;
      const done = (val) => { if (settled) return; settled = true; resolve(val); };
      const m = modal({
        title: o.title || 'Confirmar ação',
        subtitle: o.message || '',
        size: 'sm',
        icon: o.icon || 'alert',
        iconTone: o.danger ? 'danger' : '',
        body: o.detail ? `<div class="notice ${o.danger ? 'danger' : 'neutral'}">${icon('info')}<div>${o.detail}</div></div>` : '',
        footer: `
          <button class="btn btn-ghost" data-cancel>${esc(o.cancelLabel || 'Cancelar')}</button>
          <button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(o.confirmLabel || 'Confirmar')}</button>`,
        onMount: (el, close) => {
          el.querySelector('[data-cancel]').addEventListener('click', () => { done(false); close(); });
          el.querySelector('[data-ok]').addEventListener('click', () => { done(true); close(); });
          el.parentElement.addEventListener('mousedown', (ev) => {
            if (ev.target === el.parentElement) done(false);
          });
        }
      });
      void m;
    });
  }

  /* ---------- Route helpers ---------- */
  const STATUS = {
    picked: { label: 'Aluno pego', short: 'Pego', icon: 'checkCircle', cls: 'b-green', dot: 'green' },
    next: { label: 'Próximo destino', short: 'Próximo', icon: 'nav', cls: 'b-blue', dot: 'blue' },
    waiting: { label: 'Aguardando', short: 'Aguardando', icon: 'clock', cls: 'b-gray', dot: 'gray' },
    issue: { label: 'Problema na coleta', short: 'Problema', icon: 'alert', cls: 'b-red', dot: 'red' },
    delivered: { label: 'Entregue na residência', short: 'Entregue', icon: 'checkCircle', cls: 'b-green', dot: 'green' },
    no_delivery: { label: 'Entrega não realizada', short: 'Não entregue', icon: 'alert', cls: 'b-red', dot: 'red' }
  };

  function statusBadge(status, large) {
    const s = STATUS[status] || STATUS.waiting;
    return `<span class="badge ${s.cls} ${large ? 'badge-lg' : ''}">${icon(s.icon)}${s.short}</span>`;
  }

  function avatarTone(status) {
    if (status === 'picked' || status === 'delivered') return 'g';
    if (status === 'issue' || status === 'no_delivery') return 'r';
    if (status === 'next') return '';
    return 'n';
  }

  /* ---------- Logotipo ---------- */
  function logoSvg(size) {
    const dim = size ? ` width="${size}" height="${size}"` : 'width="100%" height="100%"';
    return `<svg viewBox="0 0 48 48"${dim} aria-hidden="true">
      <defs>
        <linearGradient id="ktPinGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2E7BF6"/><stop offset="1" stop-color="#0B3E92"/>
        </linearGradient>
      </defs>
      <path d="M24 2.8c-9.7 0-17.6 7.9-17.6 17.6 0 12.6 15.1 23.2 16.7 24.3.6.4 1.3.4 1.9 0 1.6-1.1 16.7-11.7 16.7-24.3C41.6 10.7 33.7 2.8 24 2.8Z" fill="url(#ktPinGrad)"/>
      <path d="M16.6 19.2 19 15.6h8.6l2.6 3.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      <rect x="13.4" y="18.8" width="21.2" height="9.6" rx="2.6" fill="#fff"/>
      <rect x="16" y="20.6" width="5.2" height="3.6" rx=".9" fill="#1265E8"/>
      <rect x="22.4" y="20.6" width="6.2" height="3.6" rx=".9" fill="#1265E8"/>
      <circle cx="18.4" cy="28.2" r="2.5" fill="#071629"/><circle cx="29.6" cy="28.2" r="2.5" fill="#071629"/>
      <circle cx="18.4" cy="28.2" r=".9" fill="#fff"/><circle cx="29.6" cy="28.2" r=".9" fill="#fff"/>
      <circle cx="33.1" cy="24.4" r="1" fill="#1265E8"/>
    </svg>`;
  }

  /* ---------- Exports ---------- */
  K.logoSvg = logoSvg;
  K.$ = $;
  K.$$ = $$;
  K.h = h;
  K.esc = esc;
  K.on = on;
  K.icon = icon;
  K.ICONS = ICONS;
  K.fmt = {
    time: fmtTime, date: fmtDate, dateShort: fmtDateShort, weekday: fmtWeekday, todayLong: fmtTodayLong,
    duration: fmtDuration, km: fmtKm, distance: fmtDistance, phone: formatPhone, maskPhone,
    initials, firstName, greeting, pad
  };
  K.geo = { haversine, pathDistance, interpolate, bearing, R_EARTH };
  K.util = { uid, clamp, debounce, download, toCSV, storageGet, storageSet, storageRemove, hashPassword };
  K.toast = toast;
  K.modal = modal;
  K.confirm = confirmDialog;
  K.STATUS = STATUS;
  K.statusBadge = statusBadge;
  K.avatarTone = avatarTone;
})(window.KT);
