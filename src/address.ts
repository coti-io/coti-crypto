import { BaseAddress } from './baseAddress';
import { KeyPair, getCheckSumFromHexString, paddingPublicKeyByCoordinates } from './utils/cryptoUtils';

export class Address extends BaseAddress {
  private keyPair: KeyPair;
  private index: number;

  constructor(keyPair: KeyPair, index: number) {
    let publicXKeyHex = keyPair
      .getPublic()
      .getX()
      .toString(16, 2);
    let publicYKeyHex = keyPair
      .getPublic()
      .getY()
      .toString(16, 2);

    let paddedAddress = paddingPublicKeyByCoordinates(publicXKeyHex, publicYKeyHex);
    let checkSumHex = getCheckSumFromHexString(paddedAddress);

    let addressWithCheckSum = paddedAddress + checkSumHex;
    super(addressWithCheckSum);

    this.keyPair = keyPair;
    this.index = index;
  }

  public getAddressKeyPair() {
    return this.keyPair;
  }

  public getIndex() {
    return this.index;
  }
}
