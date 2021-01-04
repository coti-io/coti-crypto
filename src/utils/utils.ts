import * as moment from 'moment';
import Decimal from 'decimal.js';

export type Network = 'mainnet' | 'testnet' | 'testnet_staging';

export type BigDecimalValue = Decimal.Value;

export class BigDecimal extends Decimal {
  constructor(n: BigDecimalValue) {
    super(n);
  }

  public compareTo(other: BigDecimal) {
    return super.comparedTo(other);
  }

  public stripTrailingZeros() {
    return new BigDecimal(removeZerosFromEndOfStringOfNumber(this.toString()));
  }

  public add(other: BigDecimal): BigDecimal {
    return new BigDecimal(super.add(other));
  }

  public subtract(other: BigDecimal) {
    return new BigDecimal(super.sub(other));
  }

  public multiply(other: BigDecimal) {
    return new BigDecimal(super.mul(other));
  }

  public divide(other: BigDecimal) {
    return new BigDecimal(super.div(other));
  }
}

export function utcNowToSeconds() {
  return moment.utc().valueOf() / 1000;
}

export function utcStringToSeconds(utcString: string) {
  return moment.utc(utcString).valueOf() / 1000;
}

export function getBytesFromString(str: string) {
  return new Uint8Array(getArrayFromString(str));
}

export function getArrayFromString(str: string) {
  return str.split('').map(e => e.charCodeAt(0));
}

export function hexToBytes(hex: string) {
  return new Uint8Array(hexToArray(hex));
}

export function hexToArray(hex: string) {
  if (hex.length % 2 !== 0) {
    throw new Error(`hexBinary needs to be even-length: ${hex}`);
  }
  let array: number[] = [];
  for (let c = 0; c < hex.length; c += 2) {
    array.push(parseInt(hex.substr(c, 2), 16));
  }
  return array;
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

export function numberToByteArray(num: number, byteLength: number) {
  let bytes = new Uint8Array(byteLength);
  for (let k = 0; k < byteLength; k++) {
    bytes[byteLength - 1 - k] = num & 255;
    num = num / 256;
  }
  return bytes;
}

export function removeZerosFromEndOfNumber(num: number) {
  return removeZerosFromEndOfStringOfNumber(num.toString());
}

function removeZerosFromEndOfStringOfNumber(str: string) {
  if (str.includes('.')) {
    while (str.charAt(str.length - 1) === '0') {
      str = str.substring(0, str.length - 1);
    }

    if (str.charAt(str.length - 1) === '.') str = str.substring(0, str.length - 1);
  }
  return str;
}

export function removeZeroBytesFromByteArray(bytes: Uint8Array) {
  for (let i = 0; i < bytes.byteLength; i++) {
    if (bytes[i] !== 0) {
      bytes = bytes.subarray(i, bytes.byteLength);
      break;
    }
  }
  return bytes;
}

export function concatByteArrays(byteArrays: Uint8Array[]) {
  const result = new Uint8Array(byteArrays.reduce((totalLength, byteArray) => totalLength + byteArray.byteLength, 0));
  let off = 0;
  byteArrays.forEach(byteArray => {
    result.set(byteArray, off);
    off += byteArray.byteLength;
  });
  return result;
}
