/**
 * Parse a Lighthouse JSON report and print a human-readable summary.
 * Usage: node parse-report.js [path-to-report.json]
 * Defaults to ./lighthouse-report.json
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const reportPath = process.argv[2] ?? join(__dirname, 'lighthouse-report.json')

let lhr
try {
  lhr = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch {
  console.error(`Cannot read report: ${reportPath}`)
  process.exit(1)
}

const pad = (s, n) => String(s).padEnd(n)
const line = (n = 60) => '─'.repeat(n)

// ── Top-level scores ─────────────────────────────────────────────────────────
console.log(`\nLighthouse Report  —  ${lhr.finalDisplayedUrl}`)
console.log(`Fetched: ${lhr.fetchTime}\n`)
console.log(line())
console.log(pad('Category', 26) + pad('Score', 8) + 'Bar')
console.log(line())
for (const [, cat] of Object.entries(lhr.categories)) {
  const score = Math.round(cat.score * 100)
  const color = score >= 90 ? '🟢' : score >= 50 ? '🟡' : '🔴'
  const bar = '█'.repeat(Math.round(score / 5))
  console.log(`${color} ${pad(cat.title, 24)}${pad(score, 8)}${bar}`)
}
console.log(line())

// ── Opportunities ────────────────────────────────────────────────────────────
const opportunities = Object.values(lhr.audits)
  .filter((a) => a.details?.type === 'opportunity' && a.score !== null && a.score < 1)
  .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))

if (opportunities.length) {
  console.log('\nOpportunities (sorted by savings):')
  for (const a of opportunities) {
    const savings = a.details?.overallSavingsMs
    const tag = savings != null ? ` (~${Math.round(savings)} ms)` : ''
    console.log(`  • ${a.title}${tag}`)
    if (a.description)
      console.log(
        `    ${a.description
          .replace(/\[.*?\]\(.*?\)/g, '')
          .trim()
          .slice(0, 120)}`,
      )
  }
}

// ── Diagnostics ──────────────────────────────────────────────────────────────
const diagnostics = Object.values(lhr.audits).filter((a) => a.details?.type === 'table' && a.score !== null && a.score < 1)
if (diagnostics.length) {
  console.log('\nDiagnostics:')
  for (const a of diagnostics) {
    console.log(`  • ${a.title}`)
  }
}

// ── All failing audits ───────────────────────────────────────────────────────
const skipTypes = new Set(['opportunity', 'filmstrip', 'screenshot'])
const skipIds = new Set(['metrics', 'screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot'])
const failing = Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && !skipTypes.has(a.details?.type) && !skipIds.has(a.id))
if (failing.length) {
  console.log('\nFailing audits:')
  for (const a of failing) {
    const score = a.score != null ? ` [${Math.round(a.score * 100)}]` : ''
    console.log(`  ✗${score} ${a.title}`)
    if (a.displayValue) console.log(`    → ${a.displayValue}`)
  }
}

// ── Passed ───────────────────────────────────────────────────────────────────
const passed = Object.values(lhr.audits).filter((a) => a.score === 1)
console.log(`\n✓ ${passed.length} audits passed\n`)
