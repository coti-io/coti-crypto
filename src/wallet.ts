import { EventEmitter } from 'events';
import { BaseAddress, IndexedAddress, Address } from './address';
import { Transaction, ReducedTransaction } from './transaction';
import * as walletUtils from './utils/walletUtils';
import bigDecimal from 'js-big-decimal';
import { SignatureData } from './signature';

export interface WalletEvent {
  on(event: 'balanceChange', listener: (address: BaseAddress) => void): this;
  on(event: 'generateAddress', listener: (addressHex: string) => void): this;
  on(event: 'receivedTransaction', listener: (transaction: Transaction) => void): this;

  emit(event: 'balanceChange', address: BaseAddress): boolean;
  emit(event: 'generateAddress', address: BaseAddress): boolean;
  emit(event: 'receivedTransaction', transaction: Transaction): boolean;
}

export abstract class WalletEvent extends EventEmitter {
  public onBalanceChange(listener: (address: BaseAddress) => void): this {
    return this.on('balanceChange', listener);
  }

  public onGenerateAddress(listener: (addressHex: string) => void): this {
    return this.on('generateAddress', listener);
  }

  public onReceivedTransaction(listener: (transaction: Transaction) => void): this {
    return this.on('receivedTransaction', listener);
  }
}

export class BaseWallet extends WalletEvent {
  protected readonly addressMap: Map<string, BaseAddress>;
  protected readonly transactionMap: Map<string, ReducedTransaction>;

  constructor() {
    super();
    this.addressMap = new Map();
    this.transactionMap = new Map();
  }

  public async loadAddresses(addresses: BaseAddress[]) {
    if (!addresses || !addresses.length) return;
    addresses.forEach(address => {
      this.setAddressToMap(address);
    });
  }

  public isAddressExists(addressHex: string) {
    return this.addressMap.has(addressHex);
  }

  public getAddressMap() {
    return this.addressMap;
  }

  public getAddressHexes() {
    return [...this.addressMap.keys()];
  }

  protected setAddressToMap(address: BaseAddress) {
    this.addressMap.set(address.getAddressHex(), address);
  }

  public getAddressByAddressHex(addressHex: string) {
    return this.addressMap.get(addressHex);
  }

  public async checkBalancesOfAddresses(addresses: BaseAddress[]) {
    const addressesBalance = await walletUtils.checkBalances(addresses.map(address => address.getAddressHex()));
    for (const address of addresses) {
      let { addressBalance, addressPreBalance } = addressesBalance[address.getAddressHex()];
      const balance = new bigDecimal(`${addressBalance}`);
      const preBalance = new bigDecimal(`${addressPreBalance}`);
      const existingAddress = this.addressMap.get(address.getAddressHex());
      if (
        !existingAddress ||
        existingAddress.getBalance().compareTo(balance) !== 0 ||
        existingAddress.getPreBalance().compareTo(preBalance) !== 0
      ) {
        this.setAddressWithBalance(address, balance, preBalance);
      }
    }
  }

  public setAddressWithBalance(address: BaseAddress, balance: bigDecimal, preBalance: bigDecimal) {
    console.log(
      `Setting balance for address: ${address.getAddressHex()}, balance: ${balance.getValue()}, preBalance: ${preBalance.getValue()}`
    );
    address.setBalance(balance);
    address.setPreBalance(preBalance);
    this.setAddressToMap(address);

    this.emit('balanceChange', address);
  }

  public getTotalBalance() {
    let balance = new bigDecimal('0');
    let prebalance = new bigDecimal('0');
    this.addressMap.forEach(address => {
      balance = balance.add(address.getBalance());
      prebalance = prebalance.add(address.getPreBalance());
    });

    return { balance, prebalance };
  }

  public async loadTransactionHistory(transactions: ReducedTransaction[]) {
    if (!transactions || !transactions.length) return;
    transactions.forEach(tx => {
      this.transactionMap.set(tx.hash, tx);
    });
  }

  public getTransactionByHash(hash: string) {
    return this.transactionMap.get(hash);
  }

  public async getTransactionHistory() {
    const addresses = this.getAddressHexes();
    const transactions = await walletUtils.getTransactionsHistory(addresses);
    transactions.forEach(t => {
      this.setTransaction(t);
    });
  }

  public setTransaction(transaction: Transaction) {
    const existingTransaction = this.transactionMap.get(transaction.getHash());

    // If the transaction was already confirmed, no need to reprocess it
    if (
      existingTransaction &&
      existingTransaction.transactionConsensusUpdateTime === transaction.getTransactionConsensusUpdateTime()
    )
      return;

    console.log(
      `Adding transaction with hash: ${transaction.getHash()}, transactionConsensusUpdateTime: ${transaction.getTransactionConsensusUpdateTime()}`
    );
    this.transactionMap.set(transaction.getHash(), new ReducedTransaction(transaction));

    this.emit('receivedTransaction', transaction);
  }
}

type Constructor<T> = { new (...args: any[]): T };

export abstract class IndexedWallet<T extends IndexedAddress> extends BaseWallet {
  protected readonly indexToAddressHexMap: Map<number, string>;
  protected publicHash!: string;

  constructor() {
    super();
    this.indexToAddressHexMap = new Map();
  }

  private checkAddressType(address: BaseAddress) {
    throw new Error(`Address should be indexed`);
  }

  public setAddressToMap(address: BaseAddress) {
    this.checkAddressType(address);
    super.setAddressToMap(address);
    const index = (<T>address).getIndex();
    this.indexToAddressHexMap.set(index, address.getAddressHex());
  }

  public getIndexByAddress(addressHex: string) {
    const address = this.addressMap.get(addressHex);
    return address ? (<T>address).getIndex() : null;
  }

  public getAddressByIndex(index: number) {
    const address = this.indexToAddressHexMap.get(index);
  }

  public getPublicHash() {
    return this.publicHash;
  }

  public abstract async signMessage(messageInBytes: Uint8Array, addressHex?: string): Promise<SignatureData>;

  public async autoDiscoverAddresses() {
    const addresses = await walletUtils.getAddressesOfWallet(this);
    addresses.length > 0 ? await this.checkBalancesOfAddresses(addresses) : console.log('No addresses');
    return this.getAddressMap();
  }

  public abstract async generateAddressByIndex(index: number): Promise<T>;
}

export class Wallet extends IndexedWallet<Address> {}
