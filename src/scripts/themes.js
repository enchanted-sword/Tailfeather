import { dynamicStyle } from './utils/document.js';
import { getOptions } from './utils/jsTools.js';

const { formatCss } = culori;

const raven = {
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
const parchment = {
  bg: {
    mode: 'oklch',
    l: 0.9645790630658888,
    c: 0.00573603145712292,
    h: 84.56628541195676
  },
  'bg-surface': { mode: 'oklch', l: 1.0000000000000002, c: 0 },
  'bg-elevated': {
    mode: 'oklch',
    l: 0.9286323528561593,
    c: 0.008676463541431569,
    h: 84.57365138106958
  },
  'bg-input': { mode: 'oklch', l: 1.0000000000000002, c: 0 },
  text: { mode: 'oklch', l: 0.29312847409143017, c: 0 },
  'text-muted': { mode: 'oklch', l: 0.4495331968941366, c: 0 },
  'text-dim': { mode: 'oklch', l: 0.5032293384241285, c: 0 },
  accent: {
    mode: 'oklch',
    l: 0.40146059407639495,
    c: 0.07455277331879298,
    h: 275.65683039216884
  },
  'accent-hover': {
    mode: 'oklch',
    l: 0.34276359418926955,
    c: 0.07698924543706331,
    h: 275.7061582878074
  },
  'accent-dim': {
    mode: 'oklch',
    l: 0.40146059407639495,
    c: 0.07455277331879298,
    h: 275.65683039216884,
    alpha: 0.1
  },
  'accent-text': { mode: 'oklch', l: 1.0000000000000002, c: 0 },
  border: {
    mode: 'oklch',
    l: 0.8593410725601248,
    c: 0.01224746242648288,
    h: 79.77928705444101
  },
  'border-light': {
    mode: 'oklch',
    l: 0.9109285048068734,
    c: 0.010387329919544544,
    h: 81.79451898301575
  }
};
const hcDark = {
  bg: {
    mode: 'oklch',
    l: 0.1682662223294881,
    c: 0.025346802402019836,
    h: 276.0850245164733
  },
  'bg-surface': {
    mode: 'oklch',
    l: 0.18769686369463784,
    c: 0.02867983259904262,
    h: 277.0393384794466
  },
  'bg-elevated': {
    mode: 'oklch',
    l: 0.2278191633779041,
    c: 0.03333850314721321,
    h: 275.7640087458871
  },
  'bg-input': {
    mode: 'oklch',
    l: 0.14813127985900176,
    c: 0.02195509165870723,
    h: 274.20854828481987
  },
  text: {
    mode: 'oklch',
    l: 0.958520036844097,
    c: 0.005444686731319725,
    h: 274.9649189604765
  },
  'text-muted': {
    mode: 'oklch',
    l: 0.8312695626969867,
    c: 0.01836572887614027,
    h: 275.5933355431766
  },
  'text-dim': {
    mode: 'oklch',
    l: 0.7490313830962378,
    c: 0.03467026537417563,
    h: 278.0352048040291
  },
  accent: {
    mode: 'oklch',
    l: 0.7486567887358907,
    c: 0.052192143316252756,
    h: 277.63266794211927
  },
  'accent-hover': {
    mode: 'oklch',
    l: 0.7957973549646833,
    c: 0.046964440711519305,
    h: 278.48356050136715
  },
  'accent-dim': {
    mode: 'oklch',
    l: 0.7486567887358907,
    c: 0.052192143316252756,
    h: 277.63266794211927,
    alpha: 0.2
  },
  'accent-text': {
    mode: 'oklch',
    l: 0.1682662223294881,
    c: 0.025346802402019836,
    h: 276.0850245164733
  },
  border: {
    mode: 'oklch',
    l: 0.36918357705412685,
    c: 0.0465522698505322,
    h: 278.9577584101236
  },
  'border-light': {
    mode: 'oklch',
    l: 0.30511878840854895,
    c: 0.0416803622760838,
    h: 277.9066624838038
  }
};
const hcLight = {
  bg: {
    mode: 'oklch',
    l: 0.9603337458859315,
    c: 0.006719108115472759,
    h: 295.44972616291955
  },
  'bg-surface': { mode: 'oklch', l: 1.0000000000000002, c: 0 },
  'bg-elevated': {
    mode: 'oklch',
    l: 0.9287970217151127,
    c: 0.010917557737006341,
    h: 297.6159859728717
  },
  'bg-input': { mode: 'oklch', l: 1.0000000000000002, c: 0 },
  text: {
    mode: 'oklch',
    l: 0.17322754109050756,
    c: 0.02286536904306456,
    h: 279.7129729941276
  },
  'text-muted': {
    mode: 'oklch',
    l: 0.32309320420229054,
    c: 0.05663085224857397,
    h: 279.991927021513
  },
  'text-dim': {
    mode: 'oklch',
    l: 0.3840110752764804,
    c: 0.05435268130015083,
    h: 280.7531352785709
  },
  accent: {
    mode: 'oklch',
    l: 0.35430694487819986,
    c: 0.10245412882876795,
    h: 275.5710519363878
  },
  'accent-hover': {
    mode: 'oklch',
    l: 0.3066114914355453,
    c: 0.0985393712242352,
    h: 274.4185615987145
  },
  'accent-dim': {
    mode: 'oklch',
    l: 0.35430694487819986,
    c: 0.10245412882876795,
    h: 275.5710519363878,
    alpha: 0.1
  },
  'accent-text': { mode: 'oklch', l: 1.0000000000000002, c: 0 },
  border: {
    mode: 'oklch',
    l: 0.6502630565905604,
    c: 0.04025597197073831,
    h: 280.2176078945368
  },
  'border-light': {
    mode: 'oklch',
    l: 0.7676560331649794,
    c: 0.02562642031245228,
    h: 280.72909784806325
  }
};

const getTheme = theme => {
  switch (theme) {
    case 'light': return parchment;
    case 'hc-dark': return hcDark;
    case 'hc-light': return hcLight;
    default: return raven;
  }
};

const getFgBg = theme => {
  const selected = getTheme(theme);
  return [
    {
      text: selected.text,
      'text-muted': selected['text-muted'],
      'text-dim': selected['text-dim'],
      border: selected.border,
      'border-light': selected['border-light']
    },
    {
      bg: selected.bg,
      'bg-surface': selected['bg-surface'],
      'bg-elevated': selected['bg-elevated'],
      'bg-input': selected['bg-input'],
      accent: selected.accent,
      'accent-hover': selected['accent-hover'],
      'accent-dim': selected['accent-dim'],
    }
  ];
}

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
      const [initialFg, initialBg] = getFgBg(document.body.dataset.theme);
      const fg = lumShift(Object.entries(initialFg), fgl);
      const bg = lumShift(Object.entries(initialBg), bgl);
      entries = [...fg, ...bg];
    } else entries = getFgBg(document.body.dataset.theme).flatMap(pl => Object.entries(pl));
    if (hueshift) entries = hueShift(entries, hueshift);
    style.textContent = `:is(:root,body[data-theme]) { ${cssStr(entries)} }`;
  } else style.textContent = '';
};

export const update = async (options) => run(options);

export const main = async () => getOptions('themes').then(run);

export const clean = async () => {
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
};