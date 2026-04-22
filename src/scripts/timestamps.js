import { getOptions } from './utils/jsTools.js';
import { mutationManager } from './utils/mutation.js';
import { noact } from './utils/noact.js';

const { DateTime } = luxon;
const customClass = 'tailfeather-timestamps';
const timeSelector = 'span[data-ts]';

let formatOpts, opts;

const formatTimestamp = iso => {
  let time;
  try {
    time = DateTime.fromISO(iso).toLocaleString(formatOpts, opts);
  } catch {
    time = DateTime.fromISO(iso).toLocaleString(formatOpts); // fallback for invalid locale
  }
  return time;
};

const addTimestamps = timeElements => timeElements.forEach(timeElement => {
  const iso = timeElement.dataset.ts;
  const inheritedClasses = timeElement.className;
  const timestamp = noact({
    tag: 'time',
    className: `${customClass} ${inheritedClasses}`,
    title: DateTime.fromISO(iso).toLocaleString(DateTime.DATETIME_FULL),
    datetime: iso,
    children: formatTimestamp(iso),
  });

  timeElement.replaceWith(timestamp);
});

export const main = async () => {
  ({ formatOpts, opts } = await getOptions('timestamps'));

  try { formatOpts = JSON.parse(`"${formatOpts}"`); }
  catch {
    try { formatOpts = JSON.parse(formatOpts); }
    catch { formatOpts = DateTime.DATE_MED; }
  }
  try { opts = JSON.parse(opts); }
  catch {
    try { opts = JSON.parse(`"${opts}"`); }
    catch { opts = 'zebes' }
  }

  if (typeof formatOpts === 'string' && formatOpts in DateTime) formatOpts = DateTime[formatOpts];

  mutationManager.start(timeSelector, addTimestamps);
};

export const clean = async () => {
  mutationManager.stop(addTimestamps);
};