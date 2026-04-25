import { state } from './state.js'
import * as bt from './bt.js'
import * as midi from './midi.js'
import * as audio from './audio.js'

// ── Geometry constants ────────────────────────────────────────────────────────
const W = 500                   // SVG reference width (always 500)
const M = 24                    // margin: SVG edge → outer rect
const R = 2 * M                 // outer rect corner radius
const I = 48                    // gutter: outer rect → inner rect
const RI = M                     // inner rect corner radius
const P = 8                     // padding inside gutter
const SW = W / 90                // stroke width (scales with card)

// Derived from W (H-dependent values computed in deriveH)
const OX = M, OY = M
const OW = W - 2 * M
const IX = M + I
const IW = W - 2 * (M + I)
const CX = W / 2

// H-dependent layout (set by deriveH, called on init and resize)
let H, OH, IY, IH, CY, GUTTER_H
let WATCH_C, HEART_C, BPM_C, MIDI_C, STOP_C, JACK_C, DIGIT_H

function deriveH () {
  H = Math.max(W * 3 / 2, Math.round(W * window.innerHeight / window.innerWidth))
  OH = H - 2 * M
  IY = M + I
  IH = H - 2 * (M + I)
  CY = H / 2
  GUTTER_H = I - 2 * P
  WATCH_C = { x: IX + IW * 0.22, y: IY + IW * 0.22 }
  HEART_C = { x: CX, y: IY + IH * 0.52 }
  BPM_C = { x: CX, y: IY + IH * 0.50 }
  MIDI_C = { x: IX + IW * 0.78, y: IY + IW * 0.22 }
  STOP_C = { x: IX + IW * 0.22, y: IY + IH - IW * 0.22 }
  JACK_C = { x: IX + IW * 0.78, y: IY + IH - IW * 0.22 }
  DIGIT_H = IH * 0.12
}

// ── SVG namespace + helpers ───────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg'
const f = n => n.toFixed(3)

function el (tag, attrs = {}) {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}

// ── Icon loading (inline, no symbols) ────────────────────────────────────────
const iconCache = {}
const SKIP_TAGS = /^(defs|metadata|title|desc|namedview|sodipodi:namedview)$/i

async function fetchIcon (path) {
  if (iconCache[path]) return iconCache[path]
  const doc = new DOMParser().parseFromString(await (await fetch(path)).text(), 'image/svg+xml')
  const src = doc.querySelector('svg')
  const vb = (src.getAttribute('viewBox') || '0 0 100 100').trim().split(/[\s,]+/).map(Number)
  const nodes = [...src.children].filter(c =>
    !SKIP_TAGS.test(c.localName) && c.namespaceURI === NS
  )
  return (iconCache[path] = { nodes, vb })
}

// Place an icon inline, centred at (cx,cy), fitting in maxW × maxH, with extra attrs on the group
function placeIcon (icon, cx, cy, maxW, maxH, attrs = {}) {
  const [vx, vy, vw, vh] = icon.vb
  const scale = Math.min(maxW / vw, maxH / vh)
  const ox = cx - vw * scale / 2 - vx * scale
  const oy = cy - vh * scale / 2 - vy * scale
  const g = el('g', { transform: `translate(${f(ox)},${f(oy)}) scale(${f(scale)})`, ...attrs })
  for (const n of icon.nodes) g.appendChild(n.cloneNode(true))
  return g
}

// ── Numbers: digit x-bounds within the 71.84×22.39 viewBox ──────────────────
// [xMin, width] for each digit 0–9 (measured from path data)
const DIGIT_VH = 22.390625
const DIGIT_X = [
  [0, 6.1875],   // 0
  [7.59375, 3.515625],   // 1
  [12.828125, 6.375],   // 2
  [20.265625, 6.1875],   // 3
  [27.625, 8.03125],   // 4
  [36.671875, 6.1875],   // 5
  [44.1875, 6.1875],   // 6
  [51.390625, 6.203125],   // 7
  [58.46875, 6.0],   // 8
  [65.65625, 6.1875],   // 9
]

let numbersNodes = []   // cloneable <g id="dN"> elements from numbers.svg

// digits: array of digit numbers; scaleYByIndex: map of index→scaleY override
function renderDigits (digits, scaleYByIndex = {}) {
  while (digitGroup.firstChild) digitGroup.removeChild(digitGroup.firstChild)
  if (!digits.length || !numbersNodes.length) return

  const scale = DIGIT_H / DIGIT_VH
  const GAP = DIGIT_H * 0.15

  let anchorOffset
  if (digits.length === 2) {
    // center falls in the gap between digit 0 and digit 1
    anchorOffset = DIGIT_X[digits[0]][1] * scale + GAP / 2
  } else if (digits.length === 3) {
    // center falls on the center of the middle digit
    anchorOffset = DIGIT_X[digits[0]][1] * scale + GAP + DIGIT_X[digits[1]][1] * scale / 2
  } else {
    const totalW = digits.reduce((s, d) => s + DIGIT_X[d][1] * scale, 0)
      + GAP * (digits.length - 1)
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
    const g = el('g', {
      transform: `translate(${f(ox)},${f(baseY + offsetY)}) scale(${f(scale)},${f(scY)})`,
    })
    g.appendChild(numbersNodes[d].cloneNode(true))
    digitGroup.appendChild(g)
    curX += dw * scale + GAP
  }
}

// ── Card DOM references ───────────────────────────────────────────────────────
let svg = null
let animLayer = null
let digitGroup = null

function updateSoundBtns () {
  const drumEl = document.getElementById('drum-btn')
  const sineEl = document.getElementById('sine-btn')
  if (drumEl) drumEl.classList.toggle('active', audio.kickOn)
  if (sineEl) sineEl.classList.toggle('active', audio.sineOn)
}

// ── Build card ────────────────────────────────────────────────────────────────
function buildCard (icons) {
  if (svg) svg.remove()

  svg = el('svg', { viewBox: `0 0 ${W} ${H}`, id: 'card' })
  document.body.appendChild(svg)

  // ── Static structure ──────────────────────────────────────────────────────
  // Outer card rect
  svg.appendChild(el('rect', {
    x: OX, y: OY, width: OW, height: OH, rx: R, ry: R, id: 'rect-outer'
  }))

  // Inner frame
  svg.appendChild(el('rect', {
    x: IX, y: IY, width: IW, height: IH, rx: RI, ry: RI,
  }))

  // Title — rotated CCW in left gutter, beginning aligned with inner rect bottom
  // scale is height-constrained, so compute actual scaled width to set pivot
  const titleCX = M + I / 2
  const [, , tvw, tvh] = icons.title.vb
  const titleScale = Math.min(IH / tvw, GUTTER_H / tvh)
  const titlePivotY = (IY + IH) - (tvw * titleScale) / 2
  const titleG = el('g', { transform: `rotate(-90,${f(titleCX)},${f(titlePivotY)})`, id: 'title' })
  titleG.appendChild(placeIcon(icons.title, titleCX + P * .5, titlePivotY, IH, GUTTER_H))
  svg.appendChild(titleG)

  // GH link — bottom-right corner gutter
  const ghSize = GUTTER_H * .88
  const ghLink = el('a', { href: 'https://github.com/darosh/midi-of-hearts', target: '_blank', id: 'gh' })
  ghLink.appendChild(placeIcon(icons.gh, W - M / 2 - I - ghSize - P * .25, H - M - I / 2, ghSize, ghSize))
  svg.appendChild(ghLink)

  // Top-left corner icons — centred in the gutter gap (M + I/2, M + I/2)
  const cornerSize = GUTTER_H
  const cornerCX = M + I / 2
  const cornerCY = M + I / 2
  svg.appendChild(placeIcon(icons.heart, cornerCX + I - P, cornerCY, cornerSize, cornerSize - P, { id: 'heart-small-icon' }))
  svg.appendChild(placeIcon(icons.midiLogo, cornerCX + I + cornerSize + P * 1.5, cornerCY, cornerSize * 5, cornerSize, { id: 'midi-small-icon' }))

  // Top-right corner — drum & sine toggle buttons
  const rightGutterCX = W - M - I / 2
  const snd1CY = IY + cornerSize / 2
  const snd2CY = snd1CY + cornerSize + P

  const drumBtn = el('g', { id: 'drum-btn', style: 'cursor:pointer' })
  drumBtn.appendChild(placeIcon(icons.drum, rightGutterCX, snd1CY, cornerSize, cornerSize, {}))
  drumBtn.addEventListener('click', () => {
    audio.toggleKick()
    updateSoundBtns()
  })
  svg.appendChild(drumBtn)

  const sineBtn = el('g', { id: 'sine-btn', style: 'cursor:pointer' })
  sineBtn.appendChild(placeIcon(icons.sine, rightGutterCX, snd2CY, cornerSize, cornerSize, {}))
  sineBtn.addEventListener('click', () => {
    audio.toggleSine()
    updateSoundBtns()
  })
  svg.appendChild(sineBtn)

  updateSoundBtns()

  // Watch — top-left inner area
  const watchSize = IW * 0.28
  const watchBtn = el('g', { id: 'watch-btn', style: 'cursor:pointer' })
  watchBtn.appendChild(placeIcon(icons.watches, WATCH_C.x, WATCH_C.y, watchSize, watchSize, {}))
  watchBtn.appendChild(placeIcon(icons.onOff, WATCH_C.x, WATCH_C.y, watchSize * .5, watchSize, { id: 'on-off' }))
  watchBtn.addEventListener('click', () =>
    state.isConnected ? bt.disconnect() : bt.connect().catch(console.error))
  svg.appendChild(watchBtn)

  const line = el('line', {
    id: 'line',
    x1: STOP_C.x,
    y1: STOP_C.y,
    x2: MIDI_C.x,
    y2: MIDI_C.y,
  })
  svg.appendChild(line)

  // BPM chart — inserted here so it renders under the heart
  const chartG = el('g', { id: 'bpm-chart' })
  const chartLine = el('polyline', {
    id: 'bpm-line'
  })
  chartG.appendChild(chartLine)
  const minLabel = el('text', {
    id: 'bpm-min-label',
    'font-size': f(SW * 5),
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
  })
  const maxLabel = el('text', {
    id: 'bpm-max-label',
    'font-size': f(SW * 5),
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
  })
  chartG.appendChild(minLabel)
  chartG.appendChild(maxLabel)
  svg.appendChild(chartG)

  // Heart — centre
  const heartSize = IW * 0.40
  const heartG = el('g', { id: 'heart' })
  heartG.appendChild(placeIcon(icons.heart, HEART_C.x, HEART_C.y, heartSize, heartSize,
    {}))
  svg.appendChild(heartG)

  // Angle of the line from STOP_C to MIDI_C (degrees, for button rotation)
  const lineAngle = Math.atan2(MIDI_C.y - STOP_C.y, MIDI_C.x - STOP_C.x) * 180 / Math.PI

  // MIDI icon — top-right (play/stop toggle) AND bottom-right (jack) — same icon
  const midiSize = IW * 0.26
  const midiBtn = el('g', {
    id: 'play-btn', style: 'cursor:pointer',
    transform: `rotate(${f(lineAngle)},${f(MIDI_C.x)},${f(MIDI_C.y)})`
  })
  midiBtn.appendChild(placeIcon(icons.play, MIDI_C.x, MIDI_C.y, midiSize, midiSize, {}))
  midiBtn.addEventListener('click', () => state.isPlaying ? midi.stop() : midi.start())
  svg.appendChild(midiBtn)

  const stopBtn = el('g', {
    id: 'stop-btn', style: 'cursor:pointer',
    transform: `rotate(${f(lineAngle)},${f(STOP_C.x)},${f(STOP_C.y)})`
  })
  stopBtn.appendChild(placeIcon(icons.stop, STOP_C.x, STOP_C.y, midiSize, midiSize, {}))
  stopBtn.addEventListener('click', () => state.isPlaying ? midi.stop() : midi.start())
  svg.appendChild(stopBtn)

  const jackBtn = el('g', { id: 'jack-btn', style: 'cursor:pointer' })
  jackBtn.appendChild(placeIcon(icons.midiIcon, JACK_C.x, JACK_C.y, midiSize, midiSize, {}))
  jackBtn.addEventListener('click', () => openPicker())
  svg.appendChild(jackBtn)

  // Beat line: heart → jack
  // svg.appendChild(el('line', {
  //   id: 'beatLine',
  //   x1: f(HEART_C.x), y1: f(HEART_C.y),
  //   x2: f(JACK_C.x), y2: f(JACK_C.y),
  //   stroke: '#ccc', 'stroke-width': f(SW * 0.6),
  //   'stroke-dasharray': `${f(P)} ${f(I / 2)}`,
  // }))

  // Animated layer (arcs, ticks, glows) — always on top
  animLayer = el('g', { id: 'anim-layer' })
  svg.appendChild(animLayer)

  // Digit group
  digitGroup = el('g', { id: 'digit-group' })
  svg.appendChild(digitGroup)
  renderDigits([])
}

// ── MIDI picker overlay ───────────────────────────────────────────────────────
const LS_OUTPUT_KEY = 'moh-midi-output'

function loadStoredOutput () {
  const id = localStorage.getItem(LS_OUTPUT_KEY)
  if (id) midi.selectOutput(id)
}

function openPicker () {
  if (svg.getElementById('midi-picker')) return   // already open

  const ports = midi.outputs()
  const items = [{ id: '', label: 'MIDI Off' }, ...ports.map(p => ({ id: p.id, label: p.name }))]
  const currentId = midi.selectedOutput()?.id ?? ''

  const rowH = I
  const totalH = items.length * rowH
  const startY = IY + (IH - totalH) / 2
  const fontSize = rowH * 0.7

  const g = el('g', { id: 'midi-picker' })

  // Background covering the inner rect
  g.appendChild(el('rect', {
    id: 'midi-picker-bg',
    x: f(IX + P), y: f(IY + P), width: f(IW - 2 * P), height: f(IH - 2 * P), rx: f(RI), ry: f(RI),
  }))

  items.forEach((item, i) => {
    const y = startY + i * rowH
    const isSelected = item.id === currentId

    const rowG = el('g', { class: 'picker-row-group' })

    // Separator line (above every row except the first)
    if (i > 0) {
      rowG.appendChild(el('line', {
        class: 'picker-divider',
        x1: f(IX), y1: f(y), x2: f(IX + IW), y2: f(y),
      }))
    }

    // Label
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

    // Invisible hit target (on top so hover works)
    const hit = el('rect', {
      class: 'picker-row-hit',
      x: f(IX), y: f(y), width: f(IW), height: f(rowH),
    })
    hit.addEventListener('click', () => {
      localStorage.setItem(LS_OUTPUT_KEY, item.id)
      midi.selectOutput(item.id)
      closePicker()
    })
    rowG.appendChild(hit)

    g.appendChild(rowG)
  })

  // Click backdrop (outside rows) closes picker
  const backdrop = el('rect', {
    x: f(OX), y: f(OY), width: f(OW), height: f(OH),
    id: 'backdrop',
    style: 'cursor:default',
  })
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closePicker()
  })
  g.insertBefore(backdrop, g.firstChild)

  svg.appendChild(g)
}

function closePicker () {
  svg.getElementById('midi-picker')?.remove()
}

// ── RAF animation loop ────────────────────────────────────────────────────────
const ARC_TRAVEL_MS = 800
const BEAT_TRAVEL_MS = 2000

let displayDigits = []   // digit array currently rendered
let targetBpm = 0
let digitAnims = []      // [{ index, startMs }]
const arcEvents = []
const DIGIT_DUR = 300

bt.on('heartrate', () => arcEvents.push({ startMs: performance.now() }))

function raf () {
  requestAnimationFrame(raf)
  const now = performance.now()
  animateWatchArcs(now)
  animateBeatTicks(now)
  animateHeartPulse(now)
  animateMidiGlow(now)
  animateDigits(now)
  renderBpmChart(now)
  updateStatus()
  updateActiveStates()
}

function updateActiveStates () {
  svg?.getElementById('watch-btn')?.classList.toggle('active', !!state.isConnected)
  svg?.getElementById('play-btn')?.classList.toggle('active', !!state.isPlaying)
  svg?.getElementById('stop-btn')?.classList.toggle('active', !state.isPlaying)
  svg?.getElementById('jack-btn')?.classList.toggle('active', !!midi.selectedOutput())
}

function updateStatus () {
  const t = svg?.getElementById('statusText')
  if (!t) return
  if (!state.isConnected) {
    t.textContent = 'Click watch to connect'
    return
  }
  t.textContent = state.isPlaying
    ? `${state.bpm} BPM — playing`
    : `${state.bpm} BPM — click MIDI to play`
}

// Watch arcs
function animateWatchArcs (now) {
  animLayer.querySelectorAll('.arc').forEach(e => e.remove())
  const cutoff = now - ARC_TRAVEL_MS
  while (arcEvents.length && arcEvents[0].startMs < cutoff) arcEvents.shift()
  for (const ev of arcEvents) {
    const t = (now - ev.startMs) / ARC_TRAVEL_MS
    const cx = WATCH_C.x + (HEART_C.x - WATCH_C.x) * t
    const cy = WATCH_C.y + (HEART_C.y - WATCH_C.y) * t
    animLayer.appendChild(el('circle', {
      class: 'arc', cx: f(cx), cy: f(cy), r: f(SW * 2 + t * SW * 3),
      opacity: 1 - t,
    }))
  }
}

// Beat ticks
function animateBeatTicks (now) {
  animLayer.querySelectorAll('.tick').forEach(e => e.remove())
  if (!state.isPlaying) return
  const x1 = HEART_C.x, y1 = HEART_C.y
  const x2 = JACK_C.x, y2 = JACK_C.y
  const dx = x2 - x1, dy = y2 - y1
  const len = I / 2
  const nx = -dy / Math.hypot(dx, dy) * len
  const ny = dx / Math.hypot(dx, dy) * len
  for (const beatTime of state.upcomingBeats) {
    const remaining = beatTime - now
    if (remaining < 0 || remaining > BEAT_TRAVEL_MS) continue
    const t = 1 - remaining / BEAT_TRAVEL_MS
    const tx = x1 + dx * t, ty = y1 + dy * t
    animLayer.appendChild(el('line', {
      class: 'tick',
      x1: f(tx - nx), y1: f(ty - ny), x2: f(tx + nx), y2: f(ty + ny),
      opacity: 0.3 + 0.7 * t,
    }))
  }
}

// Heart pulse
function animateHeartPulse (now) {
  const heartG = svg?.getElementById('heartG')
  if (!heartG) return
  const age = now - state.lastHrTime, dur = 300
  if (age > dur) {
    heartG.setAttribute('transform', '')
    return
  }
  const scale = 1 + 0.18 * Math.sin(Math.PI * age / dur)
  heartG.setAttribute('transform',
    `translate(${f(HEART_C.x)},${f(HEART_C.y)}) scale(${f(scale)}) translate(${f(-HEART_C.x)},${f(-HEART_C.y)})`)
}

// MIDI jack glow
let jackGlowEl = null

function animateMidiGlow (now) {
  // if (!jackGlowEl || !jackGlowEl.isConnected) {
  //   jackGlowEl = el('circle', {
  //     class: 'jackGlow', cx: f(JACK_C.x), cy: f(JACK_C.y), r: f(IW * 0.15),
  //   })
  //   animLayer.appendChild(jackGlowEl)
  // }
  const recent = state.upcomingBeats.filter(t => t <= now && now - t < 200)
  if (recent.length) {
    const age = now - Math.max(...recent), t = age / 200
    // jackGlowEl.setAttribute('opacity', 1 - t)
  } else {
  }
}

// BPM chart along diagonal
const CHART_WINDOW_MS = 60000

function renderBpmChart (now) {
  const chartLine = svg?.getElementById('bpm-line')
  const minLabel = svg?.getElementById('bpm-min-label')
  const maxLabel = svg?.getElementById('bpm-max-label')
  if (!chartLine) return

  const halfW = IW * 0.07

  // Direction vectors along and perpendicular to the diagonal (STOP→MIDI)
  const dx = MIDI_C.x - STOP_C.x
  const dy = MIDI_C.y - STOP_C.y
  const len = Math.hypot(dx, dy)
  const ax = dx / len, ay = dy / len
  const px = -ay, py = ax  // perp 90° CCW

  // Chart endpoints inset from symbols
  const symbolInset = IW * 0.08
  const startX = STOP_C.x + ax * symbolInset  // oldest end (STOP/square side)
  const startY = STOP_C.y + ay * symbolInset
  const endX = MIDI_C.x - ax * symbolInset    // newest end (MIDI/triangle side)
  const endY = MIDI_C.y - ay * symbolInset
  const cdx = endX - startX, cdy = endY - startY

  const cutoff = now - CHART_WINDOW_MS
  const visible = state.bpmHistory.filter(s => s.t >= cutoff)

  if (visible.length < 2) {
    chartLine.setAttribute('points', `${f(startX)},${f(startY)} ${f(endX)},${f(endY)}`)
    minLabel.textContent = ''
    maxLabel.textContent = ''
    return
  }

  const bpms = visible.map(s => s.bpm)
  let bMin = Math.min(...bpms)
  let bMax = Math.max(...bpms)
  if (bMax - bMin < 10) {
    const mid = (bMin + bMax) / 2
    bMin = mid - 5
    bMax = mid + 5
  }
  const bSpan = bMax - bMin

  const pts = visible.map(s => {
    // tFrac: 0 = 60s ago (STOP/oldest end), 1 = now (MIDI/newest end)
    const tFrac = Math.max(0, Math.min(1, (s.t - cutoff) / CHART_WINDOW_MS))
    // bFrac: -1 = high BPM (one perp side), +1 = low BPM (other perp side)
    const bFrac = (bMax - s.bpm) / bSpan * 2 - 1

    const svgX = startX + tFrac * cdx + bFrac * px * halfW
    const svgY = startY + tFrac * cdy + bFrac * py * halfW
    return `${f(svgX)},${f(svgY)}`
  }).join(' ')

  chartLine.setAttribute('points', pts)

  // Labels near STOP_C (oldest/left end), perpendicular offsets
  const hasVariance = bMax - bMin > 1
  if (hasVariance) {
    const labelOffset = halfW * 1.6
    // max label on the -perp side (high BPM direction)
    maxLabel.setAttribute('x', f(startX - px * labelOffset))
    maxLabel.setAttribute('y', f(startY - py * labelOffset))
    maxLabel.textContent = Math.round(bMax)
    // min label on the +perp side (low BPM direction)
    minLabel.setAttribute('x', f(startX + px * labelOffset))
    minLabel.setAttribute('y', f(startY + py * labelOffset))
    minLabel.textContent = Math.round(bMin)
  } else {
    minLabel.textContent = ''
    maxLabel.textContent = ''
  }
}

// Digit transition — per-changed-digit only
function animateDigits (now) {
  if (state.bpm !== targetBpm) {
    const newDigits = state.bpm > 0 ? String(Math.round(state.bpm)).split('').map(Number) : []
    targetBpm = state.bpm
    // Pad both to same length (right-aligned)
    const maxLen = Math.max(displayDigits.length, newDigits.length)
    const oldPad = [...Array(maxLen - displayDigits.length).fill(null), ...displayDigits]
    const newPad = [...Array(maxLen - newDigits.length).fill(null), ...newDigits]
    for (let i = 0; i < maxLen; i++) {
      if (oldPad[i] !== newPad[i]) {
        const existing = digitAnims.find(a => a.index === i && a.maxLen === maxLen)
        if (existing) existing.startMs = now
        else digitAnims.push({ index: i, maxLen, startMs: now })
      }
    }
    displayDigits = [...newDigits]
  }

  // Remove finished anims
  digitAnims = digitAnims.filter(a => now - a.startMs < DIGIT_DUR)

  // Build scaleY map keyed by displayDigits index
  const scaleYByIndex = {}
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
export async function init () {
  const paths = {
    watches: './svg/watches.svg',
    onOff: './svg/on-off.svg',
    heart: './svg/heart.svg',
    midiIcon: './svg/midi-icon.svg',
    midiLogo: './svg/midi-logo.svg',
    title: './svg/title.svg',
    play: './svg/play.svg',
    stop: './svg/stop.svg',
    gh: './svg/help.svg',
    numbers: './svg/numbers.svg',
    drum: './svg/drum-icon.svg',
    sine: './svg/sine-icon.svg',
  }

  const icons = Object.fromEntries(
    await Promise.all(Object.entries(paths).map(async ([id, path]) => [id, await fetchIcon(path)]))
  )

  // Extract digit nodes from the already-fetched numbers icon
  // icons.numbers.nodes contains the <g id="dN"> elements in reverse order (d9 first in file)
  for (let d = 0; d <= 9; d++) {
    const g = icons.numbers.nodes.find(n => n.id === `d${d}`)
    numbersNodes[d] = g || el('g')
  }

  deriveH()
  buildCard(icons)
  loadStoredOutput()
  midi.onBeat(t => audio.scheduleBeat(t, state.bpm))

  // Rebuild on resize (debounced)
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      jackGlowEl = null
      displayDigits = []
      digitAnims = []
      closePicker()
      deriveH()
      buildCard(icons)
    }, 200)
  })

  requestAnimationFrame(raf)
}
