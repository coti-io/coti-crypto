export function numberToByteArray(num: number, byteLength: number) {
  let bytes = new Uint8Array(byteLength - 1);
  for (let k = 0; k < byteLength; k++) {
    bytes[byteLength - 1 - k] = num & 255;
    num = num / 256;
  }
  return bytes;
}
