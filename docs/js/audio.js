let ctx = null
export let kickOn = false
export let sineOn = false

const pending = []

function ensureCtx () {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
}

export function cancelPendingAudio () {
  const now = ctx ? ctx.currentTime : 0
  for (const osc of pending) {
    try { osc.stop(now) } catch (_) {}
  }
  pending.length = 0
}

export function toggleKick () {
  kickOn = !kickOn
  if (kickOn) {
    sineOn = false
    ensureCtx()
  }
  cancelPendingAudio()
}

export function toggleSine () {
  sineOn = !sineOn
  if (sineOn) {
    kickOn = false
    ensureCtx()
  }
  cancelPendingAudio()
}

export function scheduleBeat (perfNowTime, bpm) {
  if (!ctx) return
  const offset = (perfNowTime - performance.now()) / 1000
  const at = ctx.currentTime + Math.max(0, offset)
  if (kickOn) scheduleKick(at)
  if (sineOn) scheduleSineNote(at, bpm)
}

function scheduleKick (at) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.setValueAtTime(150, at)
  osc.frequency.exponentialRampToValueAtTime(50, at + 0.3)
  gain.gain.setValueAtTime(1, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.35)
  osc.start(at)
  osc.stop(at + 0.35)
  pending.push(osc)
  osc.onended = () => { const i = pending.indexOf(osc); if (i !== -1) pending.splice(i, 1) }
}

function scheduleSineNote (at, bpm) {
  // ECG monitor beep: flat sustain, no decay — pitch tracks BPM (440 Hz at 60 bpm)
  const freq = 440 * (bpm / 60)
  const hold = 0.08
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, at)
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(0.5, at + 0.005)   // sharp attack
  gain.gain.setValueAtTime(0.5, at + hold)              // flat hold
  gain.gain.linearRampToValueAtTime(0, at + hold + 0.005) // sharp cutoff
  osc.start(at)
  osc.stop(at + hold + 0.01)
  pending.push(osc)
  osc.onended = () => { const i = pending.indexOf(osc); if (i !== -1) pending.splice(i, 1) }
}
