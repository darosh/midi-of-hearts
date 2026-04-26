<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->

---

# Project Overview

Single-page web app that connects to a Bluetooth smartwatch heart rate monitor and converts live BPM into MIDI clock output (24 PPQN). Features an SVG-based UI with beat animations, BPM chart, and Web Audio preview sounds.

Built with **Vite+ / TypeScript**. Source lives in `src/`, static assets in `public/`. Deployed to GitHub Pages from the `dist/` build output.

The legacy vanilla JS app is preserved in `docs/` for reference.

## Running Locally

```
vp dev
```

Requires Chromium-based browser (Chrome, Edge, Arc). Web Bluetooth and Web MIDI are not supported in Firefox or Safari. Both APIs require HTTPS or localhost.

## Building & Deploying

```
vp build       # outputs to dist/
vp preview     # preview the build locally
```

Deploy `dist/` to GitHub Pages. The Vite base path is set to `/midi-of-hearts/` in `vite.config.ts`.

## Lighthouse Audits

```
vp run audit   # run Lighthouse against dist/ and save report
vp run report  # parse and display the latest saved report
```

Scripts live in `scripts/`. Run `vp build` before auditing.

## Architecture

Modules in `src/`:

- **`state.ts`** — shared `State` object (bpm, isConnected, upcomingBeats, bpmHistory, etc.)
- **`bt.ts`** — Web Bluetooth wrapper; parses BLE Heart Rate Profile packets; emits `heartrate`, `connect`, `disconnect` events
- **`midi.ts`** — Web MIDI wrapper; 24 PPQN scheduler; lookahead 2000ms; emits beat events
- **`audio.ts`** — Web Audio API; kick drum (150→50Hz sweep) and ECG sine tone (pitch tracks BPM)
- **`ui.ts`** — SVG card UI; geometry-driven layout; RAF animation loop; SVG icons imported as `?raw` strings

Entry point: `src/main.ts` — initialises MIDI and UI in parallel, removes loading text.

Styles: `src/style.css` — dark terminal aesthetic (`#26262a` bg, `#f8423d` stroke). Font: Tulpen One served from `public/fonts/`.

SVG assets: `src/assets/svg/` — imported as raw strings via `?raw` suffix, parsed with DOMParser.

## Key Web APIs

- **Web Bluetooth** (`navigator.bluetooth.requestDevice`) — GATT `heart_rate` service
- **Web MIDI** (`navigator.requestMIDIAccess`) — MIDI clock output (0xF8), start (0xFA), stop (0xFC)
- **Web Audio** — OscillatorNode, GainNode

All require a secure context (HTTPS or localhost) and Chromium.
