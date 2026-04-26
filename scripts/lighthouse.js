/**
 * Run a Lighthouse audit against the local docs/ folder.
 * Usage: node lighthouse.js
 *
 * Starts http-server on a free port, runs Lighthouse via puppeteer,
 * saves the full JSON report to lighthouse-report.json, and prints
 * a score summary to stdout.
 */

import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import { createServer } from 'net'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import puppeteer from 'puppeteer'
import lighthouse from 'lighthouse'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = resolve(__dirname, '../dist')
const REPORT_PATH = join(__dirname, 'lighthouse-report.json')

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => res(p))
    })
    s.on('error', rej)
  })
}

function startServer(port) {
  return new Promise((res, rej) => {
    const proc = spawn('npx', ['http-server', DOCS_DIR, '-p', String(port), '--silent'], { stdio: 'pipe' })
    proc.on('error', rej)
    // Give it a moment to bind
    setTimeout(() => res(proc), 800)
  })
}

async function run() {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}/`

  console.log(`Starting server on port ${port}…`)
  const server = await startServer(port)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const wsEndpoint = browser.wsEndpoint()
    const port9222 = new URL(wsEndpoint).port

    console.log('Running Lighthouse…')
    const result = await lighthouse(url, {
      port: Number(port9222),
      output: 'json',
      logLevel: 'error',
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
      throttlingMethod: 'provided',
      categories: ['performance', 'accessibility', 'best-practices', 'seo'],
    })

    writeFileSync(REPORT_PATH, JSON.stringify(result.lhr, null, 2))
    console.log(`\nReport saved → ${REPORT_PATH}\n`)

    printSummary(result.lhr)
  } finally {
    await browser.close()
    server.kill()
  }
}

function printSummary(lhr) {
  const cats = lhr.categories
  const scores = Object.entries(cats).map(([k, v]) => ({
    name: v.title,
    score: Math.round(v.score * 100),
  }))

  const pad = (s, n) => String(s).padEnd(n)
  const line = '─'.repeat(40)
  console.log(line)
  console.log(pad('Category', 22) + pad('Score', 8))
  console.log(line)
  for (const { name, score } of scores) {
    const bar = '█'.repeat(Math.round(score / 5))
    console.log(pad(name, 22) + pad(score, 8) + bar)
  }
  console.log(line)

  const opportunities = Object.values(lhr.audits).filter((a) => a.details?.type === 'opportunity' && a.score !== null && a.score < 1)
  if (opportunities.length) {
    console.log('\nOpportunities:')
    for (const a of opportunities) {
      const savings = a.details?.overallSavingsMs
      const suffix = savings ? ` (save ~${Math.round(savings)}ms)` : ''
      console.log(`  • ${a.title}${suffix}`)
    }
  }

  const failing = Object.values(lhr.audits).filter(
    (a) => a.score !== null && a.score < 0.9 && a.details?.type !== 'opportunity' && !['metrics', 'screenshot-thumbnails', 'final-screenshot'].includes(a.id),
  )
  if (failing.length) {
    console.log('\nFailing audits:')
    for (const a of failing) {
      console.log(`  ✗ [${a.id}] ${a.title}`)
    }
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
