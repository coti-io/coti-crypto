import { BaseAddress } from './baseAddress';

export abstract class IndexedAddress extends BaseAddress {
  protected index: number;

  constructor(addressHex: string, index: number) {
    super(addressHex);
    this.index = index;
  }

  public getIndex() {
    return this.index;
  }
}
