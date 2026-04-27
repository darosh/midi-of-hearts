export interface BpmSample {
  t: DOMHighResTimeStamp
  bpm: number
}

export interface State {
  bpm: number
  isConnected: boolean
  deviceName: string
  isPlaying: boolean
  /** performance.now() timestamps of upcoming quarter notes (written by midi.ts) */
  upcomingBeats: number[]
  lastBeatTime: number
  /** performance.now() of most recent HR notification */
  lastHrTime: number
  bpmHistory: BpmSample[]
  bpmAllTimeMin: number
  bpmAllTimeMax: number
  smoothedBpm: number
}

export const state: State = {
  bpm: 0,
  isConnected: false,
  deviceName: '',
  isPlaying: false,
  upcomingBeats: [],
  lastBeatTime: -Infinity,
  lastHrTime: -Infinity,
  bpmHistory: [],
  bpmAllTimeMin: Infinity,
  bpmAllTimeMax: -Infinity,
  smoothedBpm: 0,
}
