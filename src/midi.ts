import { state } from './state.ts'
import { cancelPendingAudio } from './audio.ts'

// Web MIDI API types (not yet in standard TypeScript DOM lib)
interface MIDIOutput {
  id: string
  name: string
  send(data: number[], timestamp?: number): void
}

interface MIDIAccess {
  outputs: Map<string, MIDIOutput>
  onstatechange: (() => void) | null
}

declare global {
  interface Navigator {
    requestMIDIAccess(options: { sysex: boolean }): Promise<MIDIAccess>
  }
}

let lookaheadMs = 2000
const SCHEDULER_MS = 30
const PPQN = 24

export function setLookahead(ms: number): void {
  lookaheadMs = ms
}

export function getLookahead(): number {
  return lookaheadMs
}

let smoothingMs = 0
let smoothedBpmVal = 0

export function setSmoothing(ms: number): void {
  smoothingMs = ms
}

export function getSmoothing(): number {
  return smoothingMs
}

export function getSmoothedBpm(): number {
  return smoothedBpmVal
}

let midiAccess: MIDIAccess | null = null
let schedulerTimer: ReturnType<typeof setInterval> | null = null
let nextPulseTime = 0
let pulseIndex = 0

export async function init(): Promise<void> {
  if (midiAccess) return
  midiAccess = await navigator.requestMIDIAccess({ sysex: false })
  midiAccess.onstatechange = notifyPortChange
  notifyPortChange()
}

export function outputs(): MIDIOutput[] {
  if (!midiAccess) return []
  return [...midiAccess.outputs.values()]
}

let selectedId = ''
export function selectOutput(id: string): void {
  selectedId = id
}
export function selectedOutput(): MIDIOutput | null {
  return midiAccess?.outputs.get(selectedId) ?? null
}

const portListeners: Array<(ports: MIDIOutput[]) => void> = []
export function onPortChange(fn: (ports: MIDIOutput[]) => void): void {
  portListeners.push(fn)
}
function notifyPortChange(): void {
  portListeners.forEach((fn) => fn(outputs()))
}

const beatListeners: Array<(time: number) => void> = []
export function onBeat(fn: (time: number) => void): void {
  beatListeners.push(fn)
}

function send(bytes: number[], timestamp?: number): void {
  selectedOutput()?.send(bytes, timestamp)
}

export function start(): void {
  if (state.isPlaying) return
  state.isPlaying = true
  nextPulseTime = performance.now()
  pulseIndex = 0
  send([0xfa])
  schedulerTimer = setInterval(runScheduler, SCHEDULER_MS)
  runScheduler()
}

export function stop(): void {
  if (!state.isPlaying) return
  state.isPlaying = false
  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
  state.upcomingBeats = []
  smoothedBpmVal = 0
  state.smoothedBpm = 0
  cancelPendingAudio()
  send([0xfc])
}

function runScheduler(): void {
  if (!state.isPlaying || state.bpm <= 0) return

  if (smoothingMs <= 0) {
    smoothedBpmVal = state.bpm
  } else {
    if (smoothedBpmVal === 0) smoothedBpmVal = state.bpm
    const alpha = 1 - Math.exp(-SCHEDULER_MS / smoothingMs)
    smoothedBpmVal += alpha * (state.bpm - smoothedBpmVal)
  }
  state.smoothedBpm = smoothedBpmVal

  const intervalMs = 60000 / (smoothedBpmVal * PPQN)
  const now = performance.now()
  const until = now + lookaheadMs

  while (nextPulseTime < until) {
    const t = nextPulseTime
    send([0xf8], t)

    if (pulseIndex % PPQN === 0) {
      state.upcomingBeats.push(t)
      if (t <= now) state.lastBeatTime = t
      beatListeners.forEach((fn) => fn(t))
    }
    pulseIndex++
    nextPulseTime += intervalMs
  }

  const cutoff = now - 100
  state.upcomingBeats = state.upcomingBeats.filter((t) => t > cutoff)
}

window.addEventListener('beforeunload', () => {
  if (state.isPlaying) send([0xfc])
})
