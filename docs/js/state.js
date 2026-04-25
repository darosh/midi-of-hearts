export const state = {
  bpm: 0,
  isConnected: false,
  deviceName: '',
  isPlaying: false,
  upcomingBeats: [],      // performance.now() timestamps of upcoming quarter notes (written by midi.js)
  lastBeatTime: -Infinity,
  lastHrTime: -Infinity,  // performance.now() of most recent HR notification
  bpmHistory: [],         // { t: DOMHighResTimeStamp, bpm: number }[]
  bpmAllTimeMin: Infinity,
  bpmAllTimeMax: -Infinity,
};
