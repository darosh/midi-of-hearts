import { state } from './state.js';

let device = null;
let hrCharacteristic = null;

const listeners = { heartrate: [], connect: [], disconnect: [] };

export function on(event, fn) { listeners[event]?.push(fn); }

function emit(event, data) { listeners[event]?.forEach(fn => fn(data)); }

export async function connect() {
  device = await navigator.bluetooth.requestDevice({
    filters: [{ services: ['heart_rate'] }],
    optionalServices: ['heart_rate'],
  });

  state.deviceName = device.name || 'Watch';
  const server = await device.gatt.connect();

  const svc = await server.getPrimaryService('heart_rate');
  hrCharacteristic = await svc.getCharacteristic('heart_rate_measurement');
  await hrCharacteristic.startNotifications();
  hrCharacteristic.addEventListener('characteristicvaluechanged', handleHr);

  state.isConnected = true;
  emit('connect', { name: state.deviceName });
}

export function disconnect() {
  if (device?.gatt.connected) device.gatt.disconnect();
  state.isConnected = false;
  state.bpm = 0;
  emit('disconnect');
}

function handleHr(event) {
  const v = event.target.value;
  const is16 = v.getUint8(0) & 0x01;
  const bpm = is16 ? v.getUint16(1, true) : v.getUint8(1);
  state.bpm = bpm;
  state.lastHrTime = performance.now();
  state.bpmHistory.push({ t: state.lastHrTime, bpm });
  if (state.bpmHistory.length > 300) state.bpmHistory.shift();
  emit('heartrate', bpm);
}

window.addEventListener('beforeunload', () => {
  if (device?.gatt.connected) device.gatt.disconnect();
});
