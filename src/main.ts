import './style.css'
import { init as initUi } from './ui.ts'

await initUi()

document.getElementById('loading')?.remove()
