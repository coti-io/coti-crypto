import * as moment from 'moment';
import Decimal from 'decimal.js';
import { keccak224 } from 'js-sha3';

export type Network = 'mainnet' | 'testnet';

export type BigDecimalValue = Decimal.Value;

export class BigDecimal extends Decimal {
  constructor(n: BigDecimalValue) {
    super(n);
  }

  public compareTo(other: BigDecimal): number {
    return super.comparedTo(other);
  }

  public stripTrailingZeros(): BigDecimal {
    return new BigDecimal(removeZerosFromEndOfStringOfNumber(this.toString()));
  }

  public add(other: BigDecimal): BigDecimal {
    return new BigDecimal(super.add(other));
  }

  public subtract(other: BigDecimal): BigDecimal {
    return new BigDecimal(super.sub(other));
  }

  public multiply(other: BigDecimal): BigDecimal {
    return new BigDecimal(super.mul(other));
  }

  public divide(other: BigDecimal): BigDecimal {
    return new BigDecimal(super.div(other));
  }

  public toPlainString(): string {
    return this.toFixed();
  }
}

export function utcNowToSeconds(): number {
  return moment.utc().valueOf() / 1000;
}

export function utcStringToSeconds(utcString: string): number {
  return moment.utc(utcString).valueOf() / 1000;
}

export function getBytesFromString(str: string): Uint8Array {
  return new Uint8Array(getArrayFromString(str));
}

export function getArrayFromString(str: string): number[] {
  return str.split('').map(e => e.charCodeAt(0));
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hexToArray(hex));
}

export function hexToArray(hex: string): number[] {
  if (hex.length % 2 !== 0) {
    throw new Error(`hexBinary needs to be even-length: ${hex}`);
  }
  let array: number[] = [];
  for (let c = 0; c < hex.length; c += 2) {
    array.push(parseInt(hex.substr(c, 2), 16));
  }
  return array;
}

export function byteArrayToHexString(byteArray: Uint8Array): string {
  if (!byteArray) {
    return '';
  }

  let hexStr = '';
  for (let byte of byteArray) {
    let hex = (byte & 0xff).toString(16);
    hex = hex.length === 1 ? '0' + hex : hex;
    hexStr += hex;
  }
  return hexStr;
}

export function numberToByteArray(num: number, byteLength: number): Uint8Array {
  let bytes = new Uint8Array(byteLength);
  for (let k = 0; k < byteLength; k++) {
    bytes[byteLength - 1 - k] = num & 255;
    num = num / 256;
  }
  return bytes;
}

export function getCurrencyHashBySymbol(symbol: string): string {
  const bytes = getBytesFromString(symbol.toLowerCase());
  return keccak224.update(bytes).hex();
}

export function removeZerosFromEndOfNumber(num: number) {
  return removeZerosFromEndOfStringOfNumber(num.toString());
}

export function removeZerosFromEndOfStringOfNumber(str: string): string {
  if (str.includes('.')) {
    while (str.charAt(str.length - 1) === '0') {
      str = str.substring(0, str.length - 1);
    }

    if (str.charAt(str.length - 1) === '.') str = str.substring(0, str.length - 1);
  }
  return str;
}

export function removeZeroBytesFromByteArray(bytes: Uint8Array): Uint8Array {
  for (let i = 0; i < bytes.byteLength; i++) {
    if (bytes[i] !== 0) {
      bytes = bytes.subarray(i, bytes.byteLength);
      break;
    }
  }
  return bytes;
}

export function concatByteArrays(byteArrays: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(byteArrays.reduce((totalLength, byteArray) => totalLength + byteArray.byteLength, 0));
  let off = 0;
  byteArrays.forEach(byteArray => {
    result.set(byteArray, off);
    off += byteArray.byteLength;
  });
  return result;
}
