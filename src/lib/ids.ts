import DeviceInfo from 'react-native-device-info';

/** RFC 4122 v4 UUID from the platform CSPRNG (polyfilled by react-native-get-random-values). */
export function uuidv4(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  // Version 4 and RFC 4122 variant bits.
  b[6] = (b[6] & 0x0f) | 0x40; // eslint-disable-line no-bitwise
  b[8] = (b[8] & 0x3f) | 0x80; // eslint-disable-line no-bitwise
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let deviceId: string | null = null;

/** Stable per-install id sent with submissions for audit (§9.3). */
export async function getDeviceId(): Promise<string> {
  deviceId ??= await DeviceInfo.getUniqueId();
  return deviceId;
}
