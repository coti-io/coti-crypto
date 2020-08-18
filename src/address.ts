import { KeyPair, getCheckSumFromAddressHex, paddingPublicKeyByCoordinates } from './utils/cryptoUtils';
import { IndexedAddress } from './indexedAddress';

export class Address extends IndexedAddress {
  private keyPair: KeyPair;

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
    let checkSumHex = getCheckSumFromAddressHex(paddedAddress);

    let addressWithCheckSum = paddedAddress + checkSumHex;
    super(addressWithCheckSum, index);

    this.keyPair = keyPair;
  }

  public getAddressKeyPair() {
    return this.keyPair;
  }
}
