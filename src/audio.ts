let ctx: AudioContext | null = null
export let kickOn = false
export let sineOn = false

const pending: OscillatorNode[] = []

function ensureCtx(): void {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
}

export function cancelPendingAudio(): void {
  const now = ctx ? ctx.currentTime : 0
  for (const osc of pending) {
    try {
      osc.stop(now)
    } catch {
      /* already stopped */
    }
  }
  pending.length = 0
}

export function toggleKick(): void {
  kickOn = !kickOn
  if (kickOn) {
    sineOn = false
    ensureCtx()
  }
  cancelPendingAudio()
}

export function toggleSine(): void {
  sineOn = !sineOn
  if (sineOn) {
    kickOn = false
    ensureCtx()
  }
  cancelPendingAudio()
}

export function scheduleBeat(perfNowTime: number, bpm: number): void {
  if (!ctx) return
  const offset = (perfNowTime - performance.now()) / 1000
  if (offset < -0.05) return
  const at = ctx.currentTime + Math.max(0.015, offset)
  if (kickOn) scheduleKick(at, bpm)
  if (sineOn) scheduleSineNote(at, bpm)
}

function scheduleKick(at: number, bpm: number): void {
  const osc = ctx!.createOscillator()
  const gain = ctx!.createGain()
  const freq = 110 * (bpm / 60)
  const hold = 60 / bpm / 4
  osc.connect(gain)
  gain.connect(ctx!.destination)
  gain.gain.setValueAtTime(0, 0)
  osc.frequency.setValueAtTime(freq, at)
  osc.frequency.exponentialRampToValueAtTime(freq / 4, at + hold - 0.05)
  gain.gain.setValueAtTime(.5, at)
  gain.gain.exponentialRampToValueAtTime(0.012, at + hold)
  gain.gain.linearRampToValueAtTime(0, at + hold + 0.005)
  osc.start(at)
  osc.stop(at + 0.35)
  pending.push(osc)
  osc.onended = () => {
    const i = pending.indexOf(osc)
    if (i !== -1) pending.splice(i, 1)
  }
}

function scheduleSineNote(at: number, bpm: number): void {
  // ECG monitor beep: flat sustain, no decay — pitch tracks BPM (440 Hz at 60 bpm)
  const freq = 440 * (bpm / 60)
  const hold = 60 / bpm / 8 // Thirty-second note in seconds, I guess :-)?
  const osc = ctx!.createOscillator()
  const gain = ctx!.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, at)
  osc.connect(gain)
  gain.connect(ctx!.destination)
  gain.gain.setValueAtTime(0, 0)
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(0.33, at + 0.005)
  gain.gain.setValueAtTime(0.33, at + hold)
  gain.gain.linearRampToValueAtTime(0, at + hold + 0.005)
  osc.start(at)
  osc.stop(at + hold + 0.01)
  pending.push(osc)
  osc.onended = () => {
    const i = pending.indexOf(osc)
    if (i !== -1) pending.splice(i, 1)
  }
}
