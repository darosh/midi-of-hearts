import './style.css'
import { init as initUi } from './ui.ts'
import { registerSW } from 'virtual:pwa-register'

await initUi()

document.getElementById('loading')?.remove()

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    if (!r) return
    // Poll for SW updates every hour
    setInterval(
      async () => {
        if (!navigator.onLine) return
        const resp = await fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
        if (resp.status === 200) await r.update()
      },
      60 * 60 * 1000,
    )
  },
})
