import { dynamicStyle } from './utils/document.js';
import { getOptions } from './utils/jsTools.js';
import { noact } from './utils/noact.js';

const { formatCss } = culori;
const defaultTheme = {
  bg: {
    mode: 'oklch',
    l: 0.23629046790688057,
    c: 0.033039388725946146,
    h: 275.8945339638642
  },
  'bg-surface': {
    mode: 'oklch',
    l: 0.257428655998238,
    c: 0.03632844141611086,
    h: 274.4613113171456
  },
  'bg-elevated': {
    mode: 'oklch',
    l: 0.3086527903952065,
    c: 0.052163885326907196,
    h: 278.36291713184096
  },
  'bg-input': {
    mode: 'oklch',
    l: 0.1947031168107562,
    c: 0.022451262104050074,
    h: 276.1473302807235
  },
  text: {
    mode: 'oklch',
    l: 0.912986653148337,
    c: 0.008406919260717237,
    h: 271.3224186243841
  },
  'text-muted': {
    mode: 'oklch',
    l: 0.6508730602485815,
    c: 0.023027109035459827,
    h: 271.04711990494883
  },
  'text-dim': {
    mode: 'oklch',
    l: 0.4882035875018292,
    c: 0.031080845904384768,
    h: 273.6061307544929
  },
  accent: {
    mode: 'oklch',
    l: 0.5547769037884757,
    c: 0.056207420184578784,
    h: 278.25189535688367
  },
  'accent-hover': {
    mode: 'oklch',
    l: 0.6340447874320659,
    c: 0.04833239197561364,
    h: 277.96927431175993
  },
  'accent-dim': {
    mode: 'oklch',
    l: 0.5547769037884757,
    c: 0.056207420184578784,
    h: 278.25189535688367
  },
  border: {
    mode: 'oklch',
    l: 0.32087225547667453,
    c: 0.04116189845505821,
    h: 278.0784611886367
  },
  'border-light': {
    mode: 'oklch',
    l: 0.28121608807957466,
    c: 0.02980225828544312,
    h: 276.0824076912562
  }
};
const fgColours = {
  text: defaultTheme.text,
  'text-muted': defaultTheme['text-muted'],
  'text-dim': defaultTheme['text-dim'],
  border: defaultTheme.border,
  'border-light': defaultTheme['border-light']
};
const bgColours = {
  bg: defaultTheme.bg,
  'bg-surface': defaultTheme['bg-surface'],
  'bg-elevated': defaultTheme['bg-elevated'],
  'bg-input': defaultTheme['bg-input'],
  accent: defaultTheme.accent,
  'accent-hover': defaultTheme['accent-hover'],
  'accent-dim': defaultTheme['accent-dim'],
};

const customClass = 'tailfeather-themes';
const style = dynamicStyle(customClass);

const lumShift = (arr, lum = 0) => arr.map(([colour, { mode, l, c, h }]) => [colour, { mode, l: Math.max(Math.min(l + lum, 1), 0), c, h }]);
const hueShift = (arr, deg = 0) => arr.map(([colour, { mode, l, c, h }]) => [colour, { mode, l, c, h: (h + deg) % 360 }]);

const cssStr = colourArr => colourArr.map(([colour, oklch]) => `--${colour}: ${colour === 'accent-dim' ? `color-mix(in oklch, ${formatCss(oklch)} 15%, transparent)` : formatCss(oklch)} !important;`).join('\n');

const run = ({ mode, hueshift, fgl, bgl, preset }) => {
  document.documentElement.setAttribute('tf-theme', `${mode}-${preset}`);
  if (mode === 'hue') {
    let entries;
    if (fgl || bgl) {
      const fg = lumShift(Object.entries(fgColours), fgl);
      const bg = lumShift(Object.entries(bgColours), bgl);
      entries = [...fg, ...bg];
    } else entries = Object.entries(defaultTheme);
    if (hueshift) entries = hueShift(entries, hueshift);
    style.textContent = `:root { ${cssStr(entries)} }`;
  } else style.textContent = '';
};

export const update = async (options) => run(options);

export const main = async () => getOptions('themes').then(run);

export const clean = async () => {
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
};