import { state } from './state.ts'
import * as bt from './bt.ts'
import * as midi from './midi.ts'
import * as audio from './audio.ts'

import watchesSvgRaw from './assets/svg/watches.svg?raw'
import onOffSvgRaw from './assets/svg/on-off.svg?raw'
import heartSvgRaw from './assets/svg/heart.svg?raw'
import midiIconSvgRaw from './assets/svg/midi-icon.svg?raw'
import midiLogoSvgRaw from './assets/svg/midi-logo.svg?raw'
import titleSvgRaw from './assets/svg/title.svg?raw'
import playSvgRaw from './assets/svg/play.svg?raw'
import stopSvgRaw from './assets/svg/stop.svg?raw'
import ghSvgRaw from './assets/svg/help.svg?raw'
import numbersSvgRaw from './assets/svg/numbers.svg?raw'
import drumSvgRaw from './assets/svg/drum-icon.svg?raw'
import sineSvgRaw from './assets/svg/sine-icon.svg?raw'

// ── Geometry constants ────────────────────────────────────────────────────────
const W = 500
const M = 24
const R = 2 * M
const I = 48
const RI = M
const P = 8
const SW = W / 90

const OX = M,
  OY = M
const OW = W - 2 * M
const IX = M + I
const IW = W - 2 * (M + I)
const CX = W / 2

interface Point {
  x: number
  y: number
}

let H = 0,
  OH = 0,
  IY = 0,
  IH = 0,
  CY = 0,
  GUTTER_H = 0
let WATCH_C: Point, HEART_C: Point, BPM_C: Point, MIDI_C: Point, STOP_C: Point, JACK_C: Point
let DIGIT_H = 0
let lineAngle = 0
let WATCH_RADIUS = 0,
  ARC_ANGLE = 0,
  ARC_MAX_R = 0

function deriveH(): void {
  H = Math.max((W * 3) / 2, Math.round((W * window.innerHeight) / window.innerWidth))
  OH = H - 2 * M
  IY = M + I
  IH = H - 2 * (M + I)
  CY = H / 2
  GUTTER_H = I - 2 * P
  WATCH_C = { x: IX + IW * 0.22, y: IY + IW * 0.22 }
  HEART_C = { x: CX, y: IY + IH * 0.52 }
  BPM_C = { x: CX, y: IY + IH * 0.5 }
  MIDI_C = { x: IX + IW * 0.78, y: IY + IW * 0.22 }
  STOP_C = { x: IX + IW * 0.22, y: IY + IH - IW * 0.22 }
  JACK_C = { x: IX + IW * 0.78, y: IY + IH - IW * 0.22 }
  DIGIT_H = IH * 0.12

  lineAngle = (Math.atan2(MIDI_C.y - STOP_C.y, MIDI_C.x - STOP_C.x) * 180) / Math.PI

  WATCH_RADIUS = IW * 0.14
  ARC_ANGLE = Math.atan2(HEART_C.y - WATCH_C.y, HEART_C.x - WATCH_C.x)
  ARC_MAX_R = Math.hypot(HEART_C.x - WATCH_C.x, HEART_C.y - WATCH_C.y)

  // Suppress unused warning — CY is available for future layout use
  void CY
  void SW
}

// ── SVG namespace + helpers ───────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg'
const f = (n: number) => n.toFixed(3)

function el(tag: string, attrs: Record<string, string> = {}): SVGElement {
  const e = document.createElementNS(NS, tag) as SVGElement
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}

// ── Icon loading from raw SVG strings ────────────────────────────────────────
const SKIP_TAGS = /^(defs|metadata|title|desc|namedview|sodipodi:namedview)$/i

interface Icon {
  nodes: Element[]
  vb: [number, number, number, number]
}

function parseIcon(raw: string): Icon {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  const src = doc.querySelector('svg')!
  const vbStr = src.getAttribute('viewBox') ?? '0 0 100 100'
  const vb = vbStr
    .trim()
    .split(/[\s,]+/)
    .map(Number) as [number, number, number, number]
  const nodes = [...src.children].filter((c) => !SKIP_TAGS.test(c.localName) && c.namespaceURI === NS)
  return { nodes, vb }
}

function placeIcon(icon: Icon, cx: number, cy: number, maxW: number, maxH: number, attrs: Record<string, string> = {}): SVGElement {
  const [vx, vy, vw, vh] = icon.vb
  const scale = Math.min(maxW / vw, maxH / vh)
  const ox = cx - (vw * scale) / 2 - vx * scale
  const oy = cy - (vh * scale) / 2 - vy * scale
  const g = el('g', { 'aria-hidden': 'true', transform: `translate(${f(ox)},${f(oy)}) scale(${f(scale)})`, ...attrs })
  for (const n of icon.nodes) g.appendChild(n.cloneNode(true))
  return g
}

function addFocusRing(parent: SVGElement, cx: number, cy: number, r: number): void {
  parent.appendChild(el('circle', { class: 'focus-ring', cx: f(cx), cy: f(cy), r: f(r) }))
}

function setHint(text: string): void {
  if (hintEl) hintEl.textContent = text
}

function clearHint(): void {
  if (hintEl) hintEl.textContent = ''
}

function wireHint(elem: SVGElement, text: string): void {
  elem.addEventListener('mouseenter', () => setHint(text))
  elem.addEventListener('mouseleave', clearHint)
  elem.addEventListener('focus', () => setHint(text))
  elem.addEventListener('blur', clearHint)
}

// ── Numbers: digit x-bounds within the 71.84×22.39 viewBox ──────────────────
const DIGIT_VH = 22.390625
const DIGIT_X: [number, number][] = [
  [0, 6.1875],
  [7.59375, 3.515625],
  [12.828125, 6.375],
  [20.265625, 6.1875],
  [27.625, 8.03125],
  [36.671875, 6.1875],
  [44.1875, 6.1875],
  [51.390625, 6.203125],
  [58.46875, 6.0],
  [65.65625, 6.1875],
]

let numbersNodes: Element[] = []

function renderDigits(digits: number[], scaleYByIndex: Record<number, number> = {}): void {
  while (digitGroup.firstChild) digitGroup.removeChild(digitGroup.firstChild)
  if (!digits.length || !numbersNodes.length) return

  const scale = DIGIT_H / DIGIT_VH
  const GAP = DIGIT_H * 0.15

  let anchorOffset: number
  if (digits.length === 2) {
    anchorOffset = DIGIT_X[digits[0]][1] * scale + GAP / 2
  } else if (digits.length === 3) {
    anchorOffset = DIGIT_X[digits[0]][1] * scale + GAP + (DIGIT_X[digits[1]][1] * scale) / 2
  } else {
    const totalW = digits.reduce((s, d) => s + DIGIT_X[d][1] * scale, 0) + GAP * (digits.length - 1)
    anchorOffset = totalW / 2
  }

  let curX = BPM_C.x - anchorOffset
  const baseY = BPM_C.y - DIGIT_H / 2 + DIGIT_H * 0.05

  for (let i = 0; i < digits.length; i++) {
    const d = digits[i]
    const scaleY = scaleYByIndex[i] ?? 1
    const [xMin, dw] = DIGIT_X[d]
    const ox = curX - xMin * scale
    const scY = scale * scaleY
    const offsetY = scaleY < 1 ? (DIGIT_H * (1 - scaleY)) / 2 : 0
    const g = el('g', { transform: `translate(${f(ox)},${f(baseY + offsetY)}) scale(${f(scale)},${f(scY)})` })
    g.appendChild(numbersNodes[d].cloneNode(true))
    digitGroup.appendChild(g)
    curX += dw * scale + GAP
  }
}

// ── Card DOM references ───────────────────────────────────────────────────────
let svg: SVGSVGElement | null = null
let animLayer: SVGElement | null = null
let icons: Record<string, Icon>
let digitGroup: SVGElement
let hintEl: SVGElement | null = null

function updateSoundBtns(): void {
  const drumEl = document.getElementById('drum-btn')
  const sineEl = document.getElementById('sine-btn')
  if (drumEl) {
    drumEl.classList.toggle('active', audio.kickOn)
    drumEl.setAttribute('aria-pressed', String(audio.kickOn))
  }
  if (sineEl) {
    sineEl.classList.toggle('active', audio.sineOn)
    sineEl.setAttribute('aria-pressed', String(audio.sineOn))
  }
}

// ── Build card ────────────────────────────────────────────────────────────────
function buildCard(iconsArg: Record<string, Icon>): void {
  if (svg) svg.remove()

  svg = el('svg', { viewBox: `0 0 ${W} ${H}`, id: 'card' }) as unknown as SVGSVGElement
  document.body.querySelector('main')!.appendChild(svg)

  svg.appendChild(el('rect', { x: String(OX), y: String(OY), width: String(OW), height: String(OH), rx: String(R), ry: String(R), id: 'rect-outer' }))
  svg.appendChild(el('rect', { x: String(IX), y: String(IY), width: String(IW), height: String(IH), rx: String(RI), ry: String(RI) }))

  animLayer = el('g', { id: 'anim-layer' })
  svg.appendChild(animLayer)

  const titleCX = M + I / 2
  const [, , tvw, tvh] = iconsArg.title.vb
  const titleScale = Math.min(IH / tvw, GUTTER_H / tvh)
  const titlePivotY = IY + IH - (tvw * titleScale) / 2
  const titleG = el('g', { transform: `rotate(-90,${f(titleCX)},${f(titlePivotY)})`, id: 'title' })
  titleG.appendChild(placeIcon(iconsArg.title, titleCX + P * 0.5, titlePivotY, IH, GUTTER_H))
  svg.appendChild(titleG)

  const ghSize = GUTTER_H * 0.88
  const ghCX = W - M / 2 - I - ghSize - P * 0.25
  const ghCY = H - M - I / 2
  const ghLink = el('a', { href: 'https://github.com/darosh/midi-of-hearts', target: '_blank', id: 'gh', 'aria-label': 'View source on GitHub' })
  ghLink.appendChild(placeIcon(iconsArg.gh, ghCX, ghCY, ghSize, ghSize))
  addFocusRing(ghLink, ghCX, ghCY, ghSize * 0.62)
  wireHint(ghLink, `More info on GitHub / Version ${__APP_VERSION__}`)
  svg.appendChild(ghLink)

  const cornerSize = GUTTER_H
  const cornerCX = M + I / 2
  const cornerCY = M + I / 2
  svg.appendChild(placeIcon(iconsArg.heart, cornerCX + I - P, cornerCY + P * 0.08, cornerSize, cornerSize - P, { id: 'heart-small-icon' }))
  svg.appendChild(placeIcon(iconsArg.midiLogo, cornerCX + I + cornerSize + P * 1.5, cornerCY, cornerSize * 5, cornerSize, { id: 'midi-small-icon' }))

  const rightGutterCX = W - M - I / 2
  const snd1CY = IY + cornerSize / 2
  const snd2CY = snd1CY + cornerSize + P

  const drumBtn = el('g', { id: 'drum-btn', style: 'cursor:pointer', role: 'button', tabindex: '0', 'aria-label': 'Toggle drum kick', 'aria-pressed': 'false' })
  drumBtn.appendChild(placeIcon(iconsArg.drum, rightGutterCX, snd1CY, cornerSize, cornerSize))
  addFocusRing(drumBtn, rightGutterCX, snd1CY, cornerSize * 0.62)
  drumBtn.addEventListener('click', () => {
    audio.toggleKick()
    updateSoundBtns()
  })
  drumBtn.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
      e.preventDefault()
      ;(drumBtn as unknown as HTMLElement).click()
    }
  })
  wireHint(drumBtn, 'Drum sound on / off')
  svg.appendChild(drumBtn)

  const sineBtn = el('g', { id: 'sine-btn', style: 'cursor:pointer', role: 'button', tabindex: '0', 'aria-label': 'Toggle sine tone', 'aria-pressed': 'false' })
  sineBtn.appendChild(placeIcon(iconsArg.sine, rightGutterCX, snd2CY, cornerSize, cornerSize))
  addFocusRing(sineBtn, rightGutterCX, snd2CY, cornerSize * 0.62)
  sineBtn.addEventListener('click', () => {
    audio.toggleSine()
    updateSoundBtns()
  })
  sineBtn.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
      e.preventDefault()
      ;(sineBtn as unknown as HTMLElement).click()
    }
  })
  wireHint(sineBtn, 'Sine sound on / off')
  svg.appendChild(sineBtn)

  updateSoundBtns()

  const watchSize = IW * 0.28
  const watchBtn = el('g', { id: 'watch-btn', style: 'cursor:pointer', role: 'button', tabindex: '0', 'aria-label': 'Connect Bluetooth heart rate monitor' })
  watchBtn.appendChild(placeIcon(iconsArg.watches, WATCH_C.x, WATCH_C.y, watchSize, watchSize))
  watchBtn.appendChild(placeIcon(iconsArg.onOff, WATCH_C.x, WATCH_C.y, watchSize * 0.5, watchSize, { id: 'on-off' }))
  addFocusRing(watchBtn, WATCH_C.x, WATCH_C.y, watchSize * 0.62)
  watchBtn.addEventListener('click', () => (state.isConnected ? bt.disconnect() : bt.connect().catch(console.error)))
  watchBtn.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
      e.preventDefault()
      ;(watchBtn as unknown as HTMLElement).click()
    }
  })
  wireHint(watchBtn, 'Connect to heart rate sensor')
  svg.appendChild(watchBtn)

  svg.appendChild(el('line', { id: 'line', x1: String(STOP_C.x), y1: String(STOP_C.y), x2: String(MIDI_C.x), y2: String(MIDI_C.y) }))

  const chartG = el('g', { id: 'bpm-chart' })
  chartG.appendChild(el('polyline', { id: 'bpm-line' }))
  const labelHalf = IW * 0.09
  const labelPerp = labelHalf + P / 2
  const minLabel = el('text', {
    id: 'bpm-min-label',
    x: f(STOP_C.x + labelPerp),
    y: f(STOP_C.y - labelHalf),
    'font-size': f(SW * 5),
    'text-anchor': 'start',
    'dominant-baseline': 'auto',
    transform: `rotate(${f(lineAngle + 90)},${f(STOP_C.x)},${f(STOP_C.y)})`,
  })
  const maxLabel = el('text', {
    id: 'bpm-max-label',
    x: f(STOP_C.x - labelPerp),
    y: f(STOP_C.y - labelHalf),
    'font-size': f(SW * 5),
    'text-anchor': 'end',
    'dominant-baseline': 'auto',
    transform: `rotate(${f(lineAngle + 90)},${f(STOP_C.x)},${f(STOP_C.y)})`,
  })
  chartG.appendChild(minLabel)
  chartG.appendChild(maxLabel)
  svg.appendChild(chartG)

  const heartSize = IW * 0.4
  const heartG = el('g', { id: 'heart' })
  heartG.appendChild(placeIcon(iconsArg.heart, HEART_C.x, HEART_C.y, heartSize, heartSize))
  svg.appendChild(heartG)

  const midiSize = IW * 0.26
  const midiBtn = el('g', {
    id: 'play-btn',
    style: 'cursor:pointer',
    role: 'button',
    tabindex: '0',
    'aria-label': 'Play MIDI clock',
    transform: `rotate(${f(lineAngle)},${f(MIDI_C.x)},${f(MIDI_C.y)})`,
  })
  midiBtn.appendChild(placeIcon(iconsArg.play, MIDI_C.x, MIDI_C.y, midiSize, midiSize))
  addFocusRing(midiBtn, MIDI_C.x, MIDI_C.y, midiSize * 0.62)
  midiBtn.addEventListener('click', () => (state.isPlaying ? midi.stop() : midi.start()))
  midiBtn.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
      e.preventDefault()
      ;(midiBtn as unknown as HTMLElement).click()
    }
  })
  wireHint(midiBtn, 'Play / Stop')
  svg.appendChild(midiBtn)

  const stopBtn = el('g', {
    id: 'stop-btn',
    style: 'cursor:pointer',
    role: 'button',
    tabindex: '0',
    'aria-label': 'Stop MIDI clock',
    transform: `rotate(${f(lineAngle)},${f(STOP_C.x)},${f(STOP_C.y)})`,
  })
  stopBtn.appendChild(placeIcon(iconsArg.stop, STOP_C.x, STOP_C.y, midiSize, midiSize))
  addFocusRing(stopBtn, STOP_C.x, STOP_C.y, midiSize * 0.62)
  stopBtn.addEventListener('click', () => (state.isPlaying ? midi.stop() : midi.start()))
  stopBtn.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
      e.preventDefault()
      ;(stopBtn as unknown as HTMLElement).click()
    }
  })
  wireHint(stopBtn, 'Stop / Play')
  svg.appendChild(stopBtn)

  const jackBtn = el('g', { id: 'jack-btn', style: 'cursor:pointer', role: 'button', tabindex: '0', 'aria-label': 'Select MIDI output' })
  jackBtn.appendChild(placeIcon(iconsArg.midiIcon, JACK_C.x, JACK_C.y, midiSize, midiSize))
  addFocusRing(jackBtn, JACK_C.x, JACK_C.y, midiSize * 0.62)
  jackBtn.addEventListener('click', () => {
    void openPicker()
  })
  jackBtn.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
      e.preventDefault()
      void openPicker()
    }
  })
  wireHint(jackBtn, 'Connect to MIDI')
  svg.appendChild(jackBtn)

  digitGroup = el('g', { id: 'digit-group' })
  svg.appendChild(digitGroup)
  renderDigits([])

  // hint text — bottom gutter, right-anchored left of gh icon
  hintEl = el('text', {
    id: 'hint',
    x: f(IX + P * 2),
    y: f(H - M - I / 2),
    'text-anchor': 'start',
    'dominant-baseline': 'middle',
    'font-size': f(GUTTER_H * 0.85),
  })
  svg.appendChild(hintEl)
}

// ── MIDI picker overlay ───────────────────────────────────────────────────────
const LS_OUTPUT_KEY = 'moh-midi-output'
let outputRestored = false

function loadStoredOutput(): void {
  const id = localStorage.getItem(LS_OUTPUT_KEY)
  if (id) midi.selectOutput(id)
}

async function openPicker(): Promise<void> {
  if (!svg) return
  if (svg.getElementById('midi-picker')) return

  try {
    await midi.init()
  } catch {
    // MIDI unavailable — show picker with no ports
  }

  if (!outputRestored) {
    loadStoredOutput()
    outputRestored = true
  }

  const ports = midi.outputs()
  const items = [{ id: '', label: 'MIDI Off' }, ...ports.map((p) => ({ id: p.id, label: p.name }))]
  const currentId = midi.selectedOutput()?.id ?? ''

  const rowH = I
  const totalH = items.length * rowH
  const startY = IY + (IH - totalH) / 2
  const fontSize = rowH * 0.7

  const g = el('g', { id: 'midi-picker' })

  g.appendChild(
    el('rect', {
      id: 'midi-picker-bg',
      x: f(IX + P),
      y: f(IY + P),
      width: f(IW - 2 * P),
      height: f(IH - 2 * P),
      rx: f(RI),
      ry: f(RI),
    }),
  )

  items.forEach((item, i) => {
    const y = startY + i * rowH
    const isSelected = item.id === currentId
    const rowG = el('g', { class: 'picker-row-group' })

    if (i > 0) {
      rowG.appendChild(el('line', { class: 'picker-divider', x1: f(IX), y1: f(y), x2: f(IX + IW), y2: f(y) }))
    }

    const label = el('text', {
      class: 'picker-label' + (isSelected ? ' selected' : ''),
      x: f(IX + IW / 2),
      y: f(y + rowH / 2),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': f(fontSize),
    })
    label.textContent = item.label
    rowG.appendChild(label)

    const hit = el('rect', { class: 'picker-row-hit', x: f(IX), y: f(y), width: f(IW), height: f(rowH) })
    hit.addEventListener('click', () => {
      localStorage.setItem(LS_OUTPUT_KEY, item.id)
      midi.selectOutput(item.id)
      closePicker()
    })
    rowG.appendChild(hit)
    g.appendChild(rowG)
  })

  const backdrop = el('rect', { x: f(OX), y: f(OY), width: f(OW), height: f(OH), id: 'backdrop', style: 'cursor:default' })
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePicker()
  })
  g.insertBefore(backdrop, g.firstChild)
  svg.appendChild(g)
}

function closePicker(): void {
  svg?.getElementById('midi-picker')?.remove()
}

// ── RAF animation loop ────────────────────────────────────────────────────────
const ARC_TRAVEL_MS = 800
const BEAT_TRAVEL_MS = 2000

let lastBeatMs = -Infinity
midi.onBeat((t) => {
  const delay = t - performance.now()
  setTimeout(
    () => {
      lastBeatMs = performance.now()
    },
    Math.max(0, delay),
  )
})

let displayDigits: number[] = []
let targetBpm = 0

interface DigitAnim {
  index: number
  maxLen: number
  startMs: number
}
let digitAnims: DigitAnim[] = []

interface ArcEvent {
  startMs: number
}
const arcEvents: ArcEvent[] = []
const DIGIT_DUR = 300

bt.on('heartrate', () => arcEvents.push({ startMs: performance.now() }))
bt.on('disconnect', () => {
  state.upcomingBeats = []
  audio.cancelPendingAudio()
})

function raf(): void {
  requestAnimationFrame(raf)
  const now = performance.now()
  animateWatchArcs(now)
  animateBeatTicks(now)
  animateHeartPulse(now)
  animateMidiGlow(now)
  animateDigits(now)
  renderBpmChart(now)
  updateActiveStates()
}

function updateActiveStates(): void {
  svg?.getElementById('watch-btn')?.classList.toggle('active', !!state.isConnected)
  svg?.getElementById('play-btn')?.classList.toggle('active', !!state.isPlaying)
  svg?.getElementById('stop-btn')?.classList.toggle('active', !state.isPlaying)
  svg?.getElementById('jack-btn')?.classList.toggle('active', !!midi.selectedOutput())
}

function animateWatchArcs(now: number): void {
  animLayer?.querySelectorAll('.arc').forEach((e) => e.remove())
  const cutoff = now - ARC_TRAVEL_MS
  while (arcEvents.length && arcEvents[0].startMs < cutoff) arcEvents.shift()
  const HALF_SPREAD = Math.PI / 12
  for (const ev of arcEvents) {
    const t = (now - ev.startMs) / ARC_TRAVEL_MS
    const r = WATCH_RADIUS + t * (ARC_MAX_R - WATCH_RADIUS)
    const a1 = ARC_ANGLE - HALF_SPREAD
    const a2 = ARC_ANGLE + HALF_SPREAD
    const x1 = WATCH_C.x + r * Math.cos(a1)
    const y1 = WATCH_C.y + r * Math.sin(a1)
    const x2 = WATCH_C.x + r * Math.cos(a2)
    const y2 = WATCH_C.y + r * Math.sin(a2)
    animLayer?.appendChild(el('path', { class: 'arc', d: `M ${f(x1)} ${f(y1)} A ${f(r)} ${f(r)} 0 0 1 ${f(x2)} ${f(y2)}`, opacity: f(1 - t) }))
  }
}

function animateBeatTicks(now: number): void {
  animLayer?.querySelectorAll('.tick').forEach((e) => e.remove())
  if (!state.isPlaying) return
  const dx = JACK_C.x - HEART_C.x,
    dy = JACK_C.y - HEART_C.y
  const totalDist = Math.hypot(dx, dy)
  const ux = dx / totalDist,
    uy = dy / totalDist
  const jackR = IW * 0.13
  const travelDist = totalDist - jackR
  for (const beatTime of state.upcomingBeats) {
    const remaining = beatTime - now
    if (remaining < 0 || remaining > BEAT_TRAVEL_MS) continue
    const t = 1 - remaining / BEAT_TRAVEL_MS
    const dist = t * travelDist
    const tx = HEART_C.x + ux * dist
    const ty = HEART_C.y + uy * dist
    animLayer?.appendChild(
      placeIcon(icons.heart, tx, ty, GUTTER_H, GUTTER_H - P, {
        class: 'tick beat-signal',
        opacity: f(0.2 + 0.8 * t),
      }),
    )
  }
}

function easeOutSine(x: number): number {
  return Math.sin((x * Math.PI) / 2)
}

function easeOut(x: number) {
  return 1 - (1 - x) ** 2
}

function animateHeartPulse(now: number): void {
  const heartG = svg?.getElementById('heart')
  if (!heartG) return
  const age = now - lastBeatMs
  const dur = state.bpm > 0 ? 60_000 / state.bpm / 2 : 300

  if (!isFinite(lastBeatMs) || age > dur) {
    heartG.setAttribute('transform', '')
    return
  }

  const T_PEAK = 0.125
  const t = Math.min(1, age / dur)
  const scaleFactor = t <= T_PEAK ? easeOutSine(t / T_PEAK) : easeOut(1 - (t - T_PEAK) / (1 - T_PEAK))

  const scale = 1 + 0.08 * scaleFactor
  heartG.setAttribute('transform', `translate(${f(HEART_C.x)},${f(HEART_C.y)}) scale(${f(scale)}) translate(${f(-HEART_C.x)},${f(-HEART_C.y)})`)
}

function animateMidiGlow(_now: number): void {
  // Reserved for future jack glow effect
}

const CHART_WINDOW_MS = 60000

function renderBpmChart(now: number): void {
  const chartLine = svg?.getElementById('bpm-line')
  const minLabel = svg?.getElementById('bpm-min-label')
  const maxLabel = svg?.getElementById('bpm-max-label')
  if (!chartLine || !minLabel || !maxLabel) return

  const halfW = IW * 0.083
  const dx = MIDI_C.x - STOP_C.x,
    dy = MIDI_C.y - STOP_C.y
  const len = Math.hypot(dx, dy)
  const ax = dx / len,
    ay = dy / len
  const px = -ay,
    py = ax

  const symbolInset = IW * 0.083 - P
  const startX = STOP_C.x + ax * symbolInset
  const startY = STOP_C.y + ay * symbolInset
  const endX = MIDI_C.x - ax * symbolInset
  const endY = MIDI_C.y - ay * symbolInset
  const cdx = endX - startX,
    cdy = endY - startY

  const cutoff = now - CHART_WINDOW_MS
  const visible = state.bpmHistory.filter((s) => s.t >= cutoff)

  if (visible.length === 0) {
    chartLine.setAttribute('points', '')
    minLabel.textContent = ''
    maxLabel.textContent = ''
    return
  }

  const bMin = state.bpmAllTimeMin
  const bMax = state.bpmAllTimeMax
  const bSpan = bMax - bMin

  const pts = visible
    .map((s) => {
      const tFrac = 1 - Math.max(0, Math.min(1, (s.t - cutoff) / CHART_WINDOW_MS))
      const bFrac = bSpan > 0 ? ((bMax - s.bpm) / bSpan) * 2 - 1 : 0
      const svgX = startX + tFrac * cdx + bFrac * px * halfW
      const svgY = startY + tFrac * cdy + bFrac * py * halfW
      return `${f(svgX)},${f(svgY)}`
    })
    .join(' ')

  chartLine.setAttribute('points', pts)

  if (bSpan > 0) {
    maxLabel.textContent = String(Math.round(bMax))
    minLabel.textContent = String(Math.round(bMin))
  } else {
    maxLabel.textContent = bMin < Infinity ? String(Math.round(bMin)) : ''
    minLabel.textContent = ''
  }
}

function animateDigits(now: number): void {
  if (state.bpm !== targetBpm) {
    const newDigits = state.bpm > 0 ? String(Math.round(state.bpm)).split('').map(Number) : []
    targetBpm = state.bpm
    const maxLen = Math.max(displayDigits.length, newDigits.length)
    const oldPad = [...Array(maxLen - displayDigits.length).fill(null), ...displayDigits]
    const newPad = [...Array(maxLen - newDigits.length).fill(null), ...newDigits]
    for (let i = 0; i < maxLen; i++) {
      if (oldPad[i] !== newPad[i]) {
        const existing = digitAnims.find((a) => a.index === i && a.maxLen === maxLen)
        if (existing) existing.startMs = now
        else digitAnims.push({ index: i, maxLen, startMs: now })
      }
    }
    displayDigits = [...newDigits]
  }

  digitAnims = digitAnims.filter((a) => now - a.startMs < DIGIT_DUR)

  const scaleYByIndex: Record<number, number> = {}
  const dLen = displayDigits.length
  for (const anim of digitAnims) {
    const di = anim.index - (anim.maxLen - dLen)
    if (di < 0 || di >= dLen) continue
    const t = Math.min(1, (now - anim.startMs) / DIGIT_DUR)
    scaleYByIndex[di] = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2
  }

  renderDigits(displayDigits, scaleYByIndex)
}

// ── MIDI port change ──────────────────────────────────────────────────────────
midi.onPortChange(() => {
  loadStoredOutput()
})

// ── Init ──────────────────────────────────────────────────────────────────────
export async function init(): Promise<void> {
  const rawSvgs: Record<string, string> = {
    watches: watchesSvgRaw,
    onOff: onOffSvgRaw,
    heart: heartSvgRaw,
    midiIcon: midiIconSvgRaw,
    midiLogo: midiLogoSvgRaw,
    title: titleSvgRaw,
    play: playSvgRaw,
    stop: stopSvgRaw,
    gh: ghSvgRaw,
    numbers: numbersSvgRaw,
    drum: drumSvgRaw,
    sine: sineSvgRaw,
  }

  icons = Object.fromEntries(Object.entries(rawSvgs).map(([id, raw]) => [id, parseIcon(raw)]))

  for (let d = 0; d <= 9; d++) {
    const g = icons.numbers.nodes.find((n) => (n as Element).id === `d${d}`)
    numbersNodes[d] = g ?? el('g')
  }

  deriveH()
  buildCard(icons)
  midi.onBeat((t) => audio.scheduleBeat(t, state.bpm))

  let resizeTimer: ReturnType<typeof setTimeout>
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      displayDigits = []
      digitAnims = []
      closePicker()
      deriveH()
      buildCard(icons)
    }, 200)
  })

  requestAnimationFrame(raf)
}
