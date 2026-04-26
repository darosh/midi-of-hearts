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
  if (kickOn) scheduleKick(at)
  if (sineOn) scheduleSineNote(at, bpm)
}

function scheduleKick(at: number): void {
  const osc = ctx!.createOscillator()
  const gain = ctx!.createGain()
  osc.connect(gain)
  gain.connect(ctx!.destination)
  gain.gain.setValueAtTime(0, 0)
  osc.frequency.setValueAtTime(150, at)
  osc.frequency.exponentialRampToValueAtTime(50, at + 0.3)
  gain.gain.setValueAtTime(1, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.35)
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
  const hold = 0.08
  const osc = ctx!.createOscillator()
  const gain = ctx!.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, at)
  osc.connect(gain)
  gain.connect(ctx!.destination)
  gain.gain.setValueAtTime(0, 0)
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(0.5, at + 0.005)
  gain.gain.setValueAtTime(0.5, at + hold)
  gain.gain.linearRampToValueAtTime(0, at + hold + 0.005)
  osc.start(at)
  osc.stop(at + hold + 0.01)
  pending.push(osc)
  osc.onended = () => {
    const i = pending.indexOf(osc)
    if (i !== -1) pending.splice(i, 1)
  }
}
