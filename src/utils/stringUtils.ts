import * as moment from 'moment';

export function getUtcInstant() {
  return moment.utc().valueOf() / 1000;
}

export function getBytesFromString(str: string) {
  return str.split('').map(e => e.charCodeAt(0));
}

export function hexToBytes(hex: string) {
  let bytes = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.substr(c, 2), 16));
  }
  return new Uint8Array(bytes);
}

export function byteArrayToHexString(uint8arr: Uint8Array) {
  if (!uint8arr) {
    return '';
  }

  var hexStr = '';
  for (var i = 0; i < uint8arr.length; i++) {
    var hex = (uint8arr[i] & 0xff).toString(16);
    hex = hex.length === 1 ? '0' + hex : hex;
    hexStr += hex;
  }
  return hexStr;
}
