import { state } from './state.js';

const LOOKAHEAD_MS = 2000;
const SCHEDULER_MS = 30;
const PPQN = 24;

let midiAccess = null;
let schedulerTimer = null;
let nextPulseTime = 0;
let pulseIndex = 0;

export async function init() {
  midiAccess = await navigator.requestMIDIAccess({ sysex: false });
  midiAccess.onstatechange = notifyPortChange;
  notifyPortChange();
}

export function outputs() {
  if (!midiAccess) return [];
  return [...midiAccess.outputs.values()];
}

let selectedId = '';
export function selectOutput(id) { selectedId = id; }
export function selectedOutput() {
  return midiAccess?.outputs.get(selectedId) ?? null;
}

const portListeners = [];
export function onPortChange(fn) { portListeners.push(fn); }
function notifyPortChange() { portListeners.forEach(fn => fn(outputs())); }

const beatListeners = [];
export function onBeat(fn) { beatListeners.push(fn); }

function send(bytes, timestamp) {
  selectedOutput()?.send(bytes, timestamp);
}

export function start() {
  if (state.isPlaying) return;
  state.isPlaying = true;
  nextPulseTime = performance.now();
  pulseIndex = 0;
  send([0xFA]);
  schedulerTimer = setInterval(runScheduler, SCHEDULER_MS);
  runScheduler();
}

export function stop() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
  state.upcomingBeats = [];
  send([0xFC]);
}

function runScheduler() {
  if (!state.isPlaying || state.bpm <= 0) return;
  const intervalMs = 60000 / (state.bpm * PPQN);
  const now = performance.now();
  const until = now + LOOKAHEAD_MS;

  while (nextPulseTime < until) {
    const t = nextPulseTime;
    send([0xF8], t);

    if (pulseIndex % PPQN === 0) {
      // Quarter note — record for animation and mark last beat
      state.upcomingBeats.push(t);
      if (t <= now) state.lastBeatTime = t;
      beatListeners.forEach(fn => fn(t));
    }
    pulseIndex++;
    nextPulseTime += intervalMs;
  }

  // Prune beats that have already passed
  const cutoff = now - 100;
  state.upcomingBeats = state.upcomingBeats.filter(t => t > cutoff);
}

window.addEventListener('beforeunload', () => {
  if (state.isPlaying) send([0xFC]);
});
