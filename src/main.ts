import './style.css';
import { init as initMidi } from './midi.ts';
import { init as initUi } from './ui.ts';

await Promise.all([
  initMidi().catch(() => console.warn('MIDI init failed')),
  initUi(),
]);

document.getElementById('loading')?.remove();
