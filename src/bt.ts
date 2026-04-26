import { state } from './state.ts'

// Web Bluetooth API types (not yet in standard TypeScript DOM lib)
interface BluetoothDevice {
  name?: string
  gatt: BluetoothRemoteGATTServer
}

interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothAPI {
  requestDevice(options: { filters: Array<{ services: string[] }>; optionalServices: string[] }): Promise<BluetoothDevice>
}

declare global {
  interface Navigator {
    bluetooth: BluetoothAPI
  }
}

type BtEvent = 'heartrate' | 'connect' | 'disconnect'
type BtListener = (data?: unknown) => void

let device: BluetoothDevice | null = null
let hrCharacteristic: BluetoothRemoteGATTCharacteristic | null = null

const listeners: Record<BtEvent, BtListener[]> = { heartrate: [], connect: [], disconnect: [] }

export function on(event: BtEvent, fn: BtListener): void {
  listeners[event]?.push(fn)
}

function emit(event: BtEvent, data?: unknown): void {
  listeners[event]?.forEach((fn) => fn(data))
}

export async function connect(): Promise<void> {
  device = await navigator.bluetooth.requestDevice({
    filters: [{ services: ['heart_rate'] }],
    optionalServices: ['heart_rate'],
  })

  state.deviceName = device.name ?? 'Watch'
  const server = await device.gatt.connect()

  const svc = await server.getPrimaryService('heart_rate')
  hrCharacteristic = await svc.getCharacteristic('heart_rate_measurement')
  await hrCharacteristic.startNotifications()
  hrCharacteristic.addEventListener('characteristicvaluechanged', handleHr)

  state.isConnected = true
  emit('connect', { name: state.deviceName })
}

export function disconnect(): void {
  if (device?.gatt.connected) device.gatt.disconnect()
  state.isConnected = false
  state.bpm = 0
  emit('disconnect')
}

function handleHr(event: Event): void {
  const v = (event.target as unknown as { value: DataView }).value
  const is16 = v.getUint8(0) & 0x01
  const bpm = is16 ? v.getUint16(1, true) : v.getUint8(1)
  state.bpm = bpm
  state.lastHrTime = performance.now()
  state.bpmHistory.push({ t: state.lastHrTime, bpm })
  if (state.bpmHistory.length > 300) state.bpmHistory.shift()
  if (bpm < state.bpmAllTimeMin) state.bpmAllTimeMin = bpm
  if (bpm > state.bpmAllTimeMax) state.bpmAllTimeMax = bpm
  emit('heartrate', bpm)
}

window.addEventListener('beforeunload', () => {
  if (device?.gatt.connected) device.gatt.disconnect()
})
