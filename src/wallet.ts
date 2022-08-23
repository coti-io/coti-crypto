import { EventEmitter } from 'events';
import { Address, BaseAddress, IndexedAddress, LedgerAddress } from './address';
import { ReducedTransaction, TransactionData } from './transaction';
import { walletUtils } from './utils/walletUtils';
import { SignatureData, SigningType } from './signature';
import * as cryptoUtils from './utils/cryptoUtils';
import { BigDecimal, Network } from './utils/utils';
import * as ledgerUtils from './utils/ledgerUtils';
import BN from 'bn.js';
import moment from 'moment';
import { ec } from 'elliptic';

type KeyPair = cryptoUtils.KeyPair;
type LedgerTransportType = ledgerUtils.LedgerTransportType;
type SigningData = ledgerUtils.SigningData;

export interface WalletEvent {
  on(event: 'balanceChange', listener: (address: BaseAddress) => void): this;

  on(event: 'generateAddress', listener: (addressHex: string) => void): this;

  on(event: 'receivedTransaction', listener: (transaction: TransactionData) => void): this;

  on(event: 'signingMessage', listener: (signingType: SigningType) => void): this;

  emit(event: 'balanceChange', address: BaseAddress): boolean;

  emit(event: 'generateAddress', addressHex: string): boolean;

  emit(event: 'receivedTransaction', transaction: TransactionData): boolean;

  emit(event: 'signingMessage', signingType: SigningType): boolean;
}

export abstract class WalletEvent extends EventEmitter {
  public onBalanceChange(listener: (address: BaseAddress) => void): this {
    return this.on('balanceChange', listener);
  }

  public onGenerateAddress(listener: (addressHex: string) => void): this {
    return this.on('generateAddress', listener);
  }

  public onReceivedTransaction(listener: (transaction: TransactionData) => void): this {
    return this.on('receivedTransaction', listener);
  }
}

export class BaseWallet extends WalletEvent {
  protected readonly network: Network;
  protected fullnode?: string;
  protected trustScoreNode?: string;
  protected readonly addressMap: Map<string, BaseAddress>;
  protected readonly transactionMap: Map<string, ReducedTransaction>;

  constructor(params: { network?: Network; fullnode?: string; trustScoreNode?: string }) {
    super();
    const { network, fullnode, trustScoreNode } = params;
    this.network = network || 'mainnet';
    this.fullnode = fullnode;
    this.trustScoreNode = trustScoreNode;
    this.addressMap = new Map();
    this.transactionMap = new Map();
  }

  public async loadAddresses(addresses: BaseAddress[]): Promise<void> {
    if (!addresses || !addresses.length) return;
    addresses.forEach(address => {
      this.setInitialAddressToMap(address);
    });
  }

  public getNetwork(): Network {
    return this.network;
  }

  public getFullNode(): string | undefined {
    return this.fullnode;
  }

  public getTrustScoreNode(): string | undefined {
    return this.trustScoreNode;
  }

  public isAddressExists(addressHex: string): boolean {
    return this.addressMap.has(addressHex);
  }

  public getAddressMap(): Map<string, BaseAddress> {
    return this.addressMap;
  }

  public getAddressHexes(): string[] {
    return [...this.addressMap.keys()];
  }

  public getAddresses(): BaseAddress[] {
    return [...this.addressMap.values()];
  }

  public async setAddress(address: BaseAddress, checkNetwork = true): Promise<void> {
    this.setInitialAddressToMap(address);
    if (checkNetwork) {
      await this.checkBalancesOfAddresses([address]);
      await this.checkTransactionHistory([address]);
    }
  }

  public getAddressByAddressHex(addressHex: string): BaseAddress | undefined {
    return this.addressMap.get(addressHex);
  }

  public async checkBalancesOfAddresses(addresses?: BaseAddress[]): Promise<void> {
    if (addresses === undefined) addresses = this.getAddresses();
    if (addresses.length === 0) return;
    const addressesBalance = await walletUtils.checkBalances(
      addresses.map(address => address.getAddressHex()),
      this
    );
    for (const address of addresses) {
      let { addressBalance, addressPreBalance } = addressesBalance[address.getAddressHex()];
      const balance = new BigDecimal(`${addressBalance}`);
      const preBalance = new BigDecimal(`${addressPreBalance}`);
      const existingAddress = this.addressMap.get(address.getAddressHex());
      if (
        !existingAddress ||
        existingAddress.getBalance().comparedTo(balance) !== 0 ||
        existingAddress.getPreBalance().comparedTo(preBalance) !== 0
      ) {
        this.setAddressWithBalance(address, balance, preBalance);
      }
    }
  }

  public setAddressWithBalance(address: BaseAddress, balance: BigDecimal, preBalance: BigDecimal): void {
    address.setBalance(balance);
    address.setPreBalance(preBalance);
    this.setAddressToMap(address);

    this.emit('balanceChange', address);
  }

  public getTotalBalance(): { balance: BigDecimal; prebalance: BigDecimal } {
    let balance = new BigDecimal('0');
    let prebalance = new BigDecimal('0');
    this.addressMap.forEach(address => {
      balance = balance.add(address.getBalance());
      prebalance = prebalance.add(address.getPreBalance());
    });

    return { balance, prebalance };
  }

  public async loadTransactions(transactions: ReducedTransaction[]): Promise<void> {
    if (!transactions || !transactions.length) return;
    transactions.forEach(reducedTransaction => {
      if (!(reducedTransaction instanceof ReducedTransaction)) throw new Error('ReducedTransaction instance required');
      this.transactionMap.set(reducedTransaction.hash, reducedTransaction);
    });
  }

  public getTransactionByHash(hash: string): ReducedTransaction | undefined {
    return this.transactionMap.get(hash);
  }

  public async checkTransactionHistory(addresses?: BaseAddress[]): Promise<void> {
    console.log('Starting to get transaction history');
    const addressHexes = addresses === undefined ? this.getAddressHexes() : addresses.map(address => address.getAddressHex());
    const transactionHistoryMap = await walletUtils.getTransactionsHistory(addressHexes, this);
    transactionHistoryMap.forEach(t => {
      this.setTransaction(t);
    });
    console.log(`Finished to get transaction history. Total transactions: ${transactionHistoryMap.size}`);
  }

  public setTransaction(transaction: TransactionData): void {
    const existingTransaction = this.transactionMap.get(transaction.hash);

    // If the transaction was already confirmed, no need to reprocess it
    let consensusDiffInSeconds;
    if (existingTransaction && existingTransaction.transactionConsensusUpdateTime && transaction.transactionConsensusUpdateTime) {
      consensusDiffInSeconds = Math.abs(
        moment
          .duration(moment.unix(existingTransaction.transactionConsensusUpdateTime).diff(moment.unix(transaction.transactionConsensusUpdateTime)))
          .asSeconds()
      );
      if (consensusDiffInSeconds <= 600) return;
    }

    this.transactionMap.set(
      transaction.hash,
      new ReducedTransaction(transaction.hash, transaction.createTime, transaction.transactionConsensusUpdateTime)
    );

    this.emit('receivedTransaction', transaction);
  }

  protected setInitialAddressToMap(address: BaseAddress): void {
    this.setAddressToMap(address);
  }

  protected setAddressToMap(address: BaseAddress): void {
    if (!(address instanceof BaseAddress)) throw new Error('BaseAddress required');
    this.addressMap.set(address.getAddressHex(), address);
  }
}

type Constructor<T> = { new (...args: any[]): T };

export abstract class IndexedWallet<T extends IndexedAddress> extends BaseWallet {
  protected maxAddress?: number;
  protected readonly indexToAddressHexMap: Map<number, string>;
  protected publicHash!: string;
  protected trustScore!: number;
  protected maxIndex?: number;
  protected webSocketIndexGap?: number;

  protected constructor(params: { network?: Network; fullnode?: string; trustScoreNode?: string; webSocketIndexGap?: number }) {
    const { network, fullnode, trustScoreNode, webSocketIndexGap } = params;
    if (webSocketIndexGap !== undefined && (!Number.isInteger(webSocketIndexGap) || webSocketIndexGap <= 0 || webSocketIndexGap > 10))
      throw new Error('Invalid webSocketIndexGap parameter');
    super({ network, fullnode, trustScoreNode });
    this.webSocketIndexGap = webSocketIndexGap;
    this.indexToAddressHexMap = new Map();
  }

  async init(): Promise<void> {
    await this.setPublicHash();
  }

  public abstract setPublicHash(): Promise<void>;

  public getMaxAddress(): number | undefined {
    return this.maxAddress;
  }

  public getMaxIndex(): number | undefined {
    return this.maxIndex;
  }

  public getWebSocketIndexGap(): number | undefined {
    return this.webSocketIndexGap;
  }

  public abstract checkAddressType(address: BaseAddress): void;

  public abstract getAddressFromIndexedAddress(indexedAddress: IndexedAddress): T;

  public getIndexByAddress(addressHex: string): number | null {
    const address = this.addressMap.get(addressHex);
    return address ? (<T>address).getIndex() : null;
  }

  public async getAddressByIndex(index: number): Promise<BaseAddress> {
    const addressHex = this.indexToAddressHexMap.get(index);
    if (!addressHex) return this.generateAndSetAddressByIndex(index);
    const address = this.addressMap.get(addressHex);
    return address ? <T>address : this.generateAndSetAddressByIndex(index);
  }

  public async generateAndSetAddressByIndex(index: number, sendToNode = true): Promise<IndexedAddress> {
    const address = await this.generateAddressByIndex(index);
    this.setAddressToMap(address);
    if (sendToNode) await walletUtils.sendAddressToNode(address, this);
    return address;
  }

  public getPublicHash(): string {
    return this.publicHash;
  }

  public abstract async signMessage(
    messageInBytes: Uint8Array,
    signingType?: SigningType,
    addressHex?: string,
    signingData?: SigningData
  ): Promise<SignatureData>;

  public onSigningMessage(listener: (signingType: SigningType) => void): this {
    return this.on('signingMessage', listener);
  }

  public async autoDiscoverAddresses(addressGap?: number): Promise<Map<string, BaseAddress>> {
    console.log(`Starting to discover addresses`);
    const addresses = await walletUtils.getAddressesOfWallet(this, addressGap);
    if (addresses.length > 0) await this.checkBalancesOfAddresses(addresses);
    console.log(`Finished to discover addresses. Total addresses: ${addresses.length}`);
    return this.getAddressMap();
  }

  public abstract async generateAddressByIndex(index: number): Promise<T>;

  public async getUserTrustScore(): Promise<number> {
    let data = await walletUtils.getUserTrustScore(this);
    if (!data) throw new Error(`Error getting user trust score, received no data`);
    if (!data.trustScore) throw new Error('Error getting user trust score, unexpected response:' + data);
    this.trustScore = data.trustScore;
    return this.trustScore;
  }

  protected addressTypeGuard(address: BaseAddress, Class: Constructor<T>): void {
    if (!(address instanceof Class)) throw new Error('Wrong address type');
  }

  protected setAddressToMap(address: BaseAddress): void {
    if (this.maxAddress && this.addressMap.get(address.getAddressHex()) === undefined && this.addressMap.size >= this.maxAddress)
      throw new Error(`Address map size can not exceed ${this.maxAddress}`);
    this.checkAddressType(address);
    super.setAddressToMap(address);
    const index = (<T>address).getIndex();
    this.indexToAddressHexMap.set(index, address.getAddressHex());
    if (this.maxIndex === undefined || this.maxIndex < index) this.maxIndex = index;
  }

  protected setInitialAddressToMap(address: BaseAddress): void {
    this.checkAddressIndexed(address);
    const typedAddress = this.getAddressFromIndexedAddress(<IndexedAddress>address);
    super.setInitialAddressToMap(typedAddress);
  }

  private checkAddressIndexed(address: BaseAddress): void {
    if (!(address instanceof IndexedAddress)) throw new Error('Address should be indexed');
  }
}

export class Wallet extends IndexedWallet<Address> {
  private seed!: string;
  private keyPair!: KeyPair;

  constructor(params: {
    seed?: string;
    userSecret?: string;
    serverKey?: BN;
    network?: Network;
    fullnode?: string;
    trustScoreNode?: string;
    webSocketIndexGap?: number;
  }) {
    const { seed, userSecret, serverKey, network, fullnode, trustScoreNode, webSocketIndexGap } = params;
    super({ network, fullnode, trustScoreNode, webSocketIndexGap });
    if (seed) {
      if (!this.checkSeedFormat(seed)) throw new Error('Seed is not in correct format');
      this.seed = seed;
    } else if (userSecret && serverKey) this.generateSeed(userSecret, serverKey);
    else throw new Error('Invalid parameters for Wallet');

    this.generateAndSetKeyPair();
    this.setPublicHash();
  }

  public async setPublicHash(): Promise<void> {
    this.publicHash = cryptoUtils.getPublicKeyByKeyPair(this.keyPair);
  }

  public async generateAddressByIndex(index: number): Promise<Address> {
    const keyPair = this.generateKeyPairByIndex(index);
    return new Address(keyPair, index);
  }

  public getAddressFromIndexedAddress(indexedAddress: IndexedAddress): Address {
    const keyPair = this.generateKeyPairByIndex(indexedAddress.getIndex());
    const address = new Address(keyPair, indexedAddress.getIndex());
    address.setBalance(indexedAddress.getBalance());
    address.setPreBalance(indexedAddress.getPreBalance());
    return address;
  }

  public checkAddressType(address: BaseAddress): void {
    this.addressTypeGuard(address, Address);
  }

  public async signMessage(
    messageInBytes: Uint8Array,
    signingType: SigningType = SigningType.MESSAGE,
    addressHex?: string
  ): Promise<ec.SignatureOptions> {
    console.log(`Signing message of type ${signingType}`);
    this.emit('signingMessage', signingType);

    let keyPair;
    if (addressHex) {
      const address = this.getAddressByAddressHex(addressHex);
      if (!address) throw new Error(`Wallet doesn't contain the address`);
      keyPair = (<Address>address).getAddressKeyPair();
    } else keyPair = this.getKeyPair();
    return cryptoUtils.signByteArrayMessage(messageInBytes, keyPair);
  }

  private checkSeedFormat(seed: string): boolean {
    return seed.length === 64;
  }

  private generateSeed(userSecret: string, serverKey: BN): void {
    let hexServerKey = serverKey.toString(16, 2);
    let combinedString = `${userSecret}${hexServerKey}`;
    this.seed = cryptoUtils.generateSeed(combinedString);
  }

  private generateAndSetKeyPair(): void {
    this.keyPair = cryptoUtils.generateKeyPairFromSeed(this.seed);
  }

  private generateKeyPairByIndex(index: number): ec.KeyPair {
    return cryptoUtils.generateKeyPairFromSeed(this.seed, index);
  }

  private getKeyPair(): ec.KeyPair {
    return this.keyPair;
  }
}

export class LedgerWallet extends IndexedWallet<LedgerAddress> {
  private readonly transportType?: LedgerTransportType;
  private readonly interactive?: boolean;

  constructor(params: {
    network?: Network;
    fullnode?: string;
    trustScoreNode?: string;
    interactive?: boolean;
    transportType?: LedgerTransportType;
    maxAddress?: number;
    webSocketIndexGap?: number;
  }) {
    const { network, fullnode, trustScoreNode, interactive, transportType, maxAddress, webSocketIndexGap } = params;
    if (maxAddress !== undefined && (!Number.isInteger(maxAddress) || maxAddress <= 0 || maxAddress > 20))
      throw new Error('Invalid maxAddress parameter');
    super({ network, fullnode, trustScoreNode, webSocketIndexGap });
    this.transportType = transportType;
    this.interactive = interactive;
    this.maxAddress = maxAddress || 20;
  }

  public async setPublicHash(): Promise<void> {
    const ledgerPublicKey = await ledgerUtils.getUserPublicKey(this.interactive, this.transportType);
    const keyPair = cryptoUtils.getKeyPairFromPublic(ledgerPublicKey);
    this.publicHash = cryptoUtils.getPublicKeyByKeyPair(keyPair);
  }

  public async loadAddresses(addresses: BaseAddress[]): Promise<void> {
    if (addresses && addresses.length > this.maxAddress!) throw new Error(`Number of addresses should be less than ${this.maxAddress}`);
    await super.loadAddresses(addresses);
  }

  public checkAddressType(address: BaseAddress): void {
    this.addressTypeGuard(address, LedgerAddress);
  }

  public async generateAddressByIndex(index: number): Promise<LedgerAddress> {
    const ledgerPublicKey = await ledgerUtils.getPublicKey(index, this.interactive, this.transportType);
    return new LedgerAddress(index, ledgerPublicKey);
  }

  public getAddressFromIndexedAddress(indexedAddress: IndexedAddress): LedgerAddress {
    const address = new LedgerAddress(indexedAddress.getIndex(), undefined, indexedAddress.getAddressHex());
    address.setBalance(indexedAddress.getBalance());
    address.setPreBalance(indexedAddress.getPreBalance());
    return address;
  }

  public async signMessage(
    messageInBytes: Uint8Array,
    signingType: SigningType = SigningType.MESSAGE,
    addressHex?: string,
    signingData?: SigningData
  ): Promise<SignatureData> {
    console.log(`Ledger device signing message of type ${signingType}`);
    this.emit('signingMessage', signingType);

    if (addressHex) {
      const address = this.getAddressByAddressHex(addressHex);
      if (!address) throw new Error(`Wallet doesn't contain the address`);
      const index = (<LedgerAddress>address).getIndex();
      return ledgerUtils.signMessage(index, messageInBytes, signingType, true, this.transportType, signingData);
    } else {
      return ledgerUtils.signUserMessage(messageInBytes, signingType, true, this.transportType, signingData);
    }
  }
}
