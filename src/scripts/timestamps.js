import { getOptions } from './utils/jsTools.js';
import { mutationManager } from './utils/mutation.js';
import { noact } from './utils/noact.js';

const { DateTime } = luxon;
const customClass = 'tailfeather-timestamps';
const timeSelector = 'span[data-ts]';
const BEAT_LENGTH = 86.4;

let formatOpts, opts, beats;

// copied from cohost's @client/lib/beats.ts
// lol

function fromDateTime(date, centibeats = false) {
  const bmtDate = date.setZone("UTC+1");
  let beats =
    (bmtDate.second + bmtDate.minute * 60 + bmtDate.hour * 3600) /
    BEAT_LENGTH;

  beats = centibeats ? beats % 1000 : Math.floor(beats % 1000);

  return `@${beats
    .toFixed(centibeats ? 2 : 0)
    .padStart(centibeats ? 6 : 3, "0")}`;
}

function beatsFormat(dateTime) {
  return `${dateTime
    .setZone("UTC+1")
    .toLocaleString(DateTime.DATE_MED)} ${fromDateTime(dateTime, true)}`;
}

const formatTimestamp = iso => {
  const dateTime = DateTime.fromISO(iso);
  let time;

  if (beats) time = beatsFormat(dateTime);
  else {
    try {
      time = dateTime.toLocaleString(formatOpts, opts);
    } catch {
      time = dateTime.toLocaleString(formatOpts); // fallback for invalid locale
    }
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
    dataset: {
      relative: timeElement.textContext,
      title: timeElement.title
    },
    datetime: iso,
    children: formatTimestamp(iso),
  });

  timeElement.replaceWith(timestamp);
});

const revertTimestamps = () => {
  document.querySelectorAll(`.${customClass}`).forEach(timeElement => {
    timeElement.replaceWith(noact({
      tag: 'span',
      className: timeElement.classList.value.replace(customClass, ''),
      title: timeElement.dataset.title,
      dataset: { ts: timeElement.datetime },
      children: timeElement.dataset.relative
    }))
  });
}

export const main = async () => {
  ({ formatOpts, opts, beats } = await getOptions('timestamps'));

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
  revertTimestamps();
};