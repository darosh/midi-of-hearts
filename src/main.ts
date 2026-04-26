import './style.css'
import { init as initUi } from './ui.ts'
import { registerSW } from 'virtual:pwa-register'

await initUi()

document.getElementById('loading')?.remove()

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    console.log('[PWA] SW registered', swUrl, r?.active?.state)
    if (!r) return
    setInterval(
      async () => {
        if (!navigator.onLine) return
        console.log('[PWA] Polling for update...')
        const resp = await fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
        console.log('[PWA] sw.js fetch status:', resp.status)
        if (resp.status === 200) await r.update()
      },
      60 * 60 * 1000,
    )
  },
  onNeedRefresh() {
    console.log('[PWA] New content available — reloading')
  },
  onOfflineReady() {
    console.log('[PWA] App ready offline')
  },
  onRegisterError(e) {
    console.error('[PWA] SW registration error', e)
  },
})
