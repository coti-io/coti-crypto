import * as stomp from 'webstomp-client';
import SockJS from 'sockjs-client';
import { walletUtils } from './utils/walletUtils';
import { nodeUtils } from './utils/nodeUtils';
import { BigDecimal } from './utils/utils';
import { BaseWallet, IndexedWallet } from './wallet';
import { BaseAddress, IndexedAddress } from './address';
import { TransactionData } from './transaction';
import { cotiParser } from './utils/jsonUtils';

export type StompClient = stomp.Client;

export class WebSocket {
  private readonly wallet: BaseWallet;
  private readonly socketUrl: string;
  private client!: StompClient;
  private reconnectCounter = 0;
  private initialConnection = false;
  private connected?: boolean;
  private successCallback?: () => Promise<void>;
  private reconnectFailedCallback?: () => Promise<void>;
  private readonly propagationSubscriptions = new Map();
  private readonly balanceSubscriptions = new Map();
  private readonly transactionsSubscriptions = new Map();

  constructor(wallet: BaseWallet) {
    this.wallet = wallet;
    this.socketUrl = nodeUtils.getSocketUrl(wallet.getNetwork(), wallet.getFullNode());
  }

  public connect(successCallback?: () => Promise<void>, reconnectFailedCallback?: () => Promise<void>) {
    if (successCallback) this.successCallback = successCallback;
    if (reconnectFailedCallback) this.reconnectFailedCallback = reconnectFailedCallback;

    const addressesInHex = this.wallet.getAddressHexes();
    console.log(`Connecting to web socket with url ${this.socketUrl}`);
    this.setClient();
    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        clearTimeout(timeout);
        reject(`Web socket connection timeout`);
      }, 10000);
      this.client.connect(
        {},
        async () => {
          console.log('Web socket client connected.');
          clearTimeout(timeout);
          this.connected = true;
          await this.onConnected(addressesInHex);
          this.initialConnection = true;
          resolve();
        },
        async error => {
          console.error(`Web socket connection error:`);
          console.error(error instanceof stomp.Frame ? error.body : error.reason);
          clearTimeout(timeout);
          await this.addressesUnsubscribe();
          if (this.connected === undefined || this.connected) {
            this.connected = false;
            await this.reconnect().catch(e => {
              if (!this.initialConnection) {
                this.initialConnection = true;
                reject(e);
              } else {
                console.error(e);
              }
            });
          }
          resolve();
        }
      );
    });
  }

  private async reconnect() {
    while (!this.connected && this.reconnectCounter <= 6) {
      console.log('Web socket trying to reconnect. Counter: ', this.reconnectCounter);
      await this.connect();
      this.reconnectCounter++;
    }
    if (!this.connected) {
      if (this.reconnectFailedCallback) await this.reconnectFailedCallback();
      throw new Error(`Web socket reconnection failed`);
    }
    this.reconnectCounter = 0;
  }

  private setClient() {
    const ws = new SockJS(this.socketUrl);
    this.client = stomp.over(ws, { debug: false });
  }

  private async closeSocketConnection() {
    await this.addressesUnsubscribe();
    this.client.disconnect();
  }

  private async addressesUnsubscribe() {
    this.propagationSubscriptions.forEach(propagationSubscription => propagationSubscription.unsubscribe());
    this.balanceSubscriptions.forEach(balanceSubscription => balanceSubscription.unsubscribe());
    this.transactionsSubscriptions.forEach(transactionsSubscription => transactionsSubscription.unsubscribe());
  }

  private async onConnected(addressesInHex: string[]) {
    this.reconnectCounter = 0;
    console.log(`Starting to websocket subscriptions of ${addressesInHex.length} addresses.`);
    if (!addressesInHex) addressesInHex = [];

    addressesInHex.forEach(addressHex => {
      this.connectToAddress(addressHex);
    });
    if (this.wallet instanceof IndexedWallet) {
      const maxAddress = this.wallet.getMaxAddress();
      const indexGap = this.wallet.getWebSocketIndexGap() || 10;
      const maxIndex = this.wallet.getMaxIndex();
      const nextIndex = maxIndex !== undefined ? maxIndex + 1 : 0;
      const maxIndexToSubscribe = maxAddress === undefined ? nextIndex + indexGap : Math.min(nextIndex + indexGap, maxAddress);
      console.log(`Subscriptions to next indexes from ${nextIndex} to ${maxIndexToSubscribe - 1}`);
      for (let i = nextIndex; i < maxIndexToSubscribe; i++) {
        const address = await this.wallet.generateAddressByIndex(i);
        this.addressPropagationSubscriber(address);
      }
    }
    console.log(`Finished to websocket subscriptions.`);

    if (this.successCallback) return this.successCallback();
  }

  public connectToAddress(addressHex: string) {
    this.subscribeToAddressBalance(addressHex);

    this.subscribeToAddressTransactions(addressHex);
  }

  private subscribeToAddressTransactions(addressHex: string) {
    if (!this.transactionsSubscriptions.get(addressHex)) {
      let transactionSubscription = this.client.subscribe(`/topic/addressTransactions/${addressHex}`, async ({ body }) => {
        try {
          const data = cotiParser(body);
          let { transactionData } = data;
          transactionData = new TransactionData(transactionData);
          transactionData.setStatus();
          this.wallet.setTransaction(transactionData);
        } catch (e) {
          console.error(`Address transaction subscription callback error for address ${addressHex}: `, e);
        }
      });

      this.transactionsSubscriptions.set(addressHex, transactionSubscription);
    }
  }

  private subscribeToAddressBalance(addressHex: string) {
    if (!this.balanceSubscriptions.get(addressHex)) {
      let balanceSubscription = this.client.subscribe(`/topic/${addressHex}`, async ({ body }) => {
        try {
          this.updateBalance(body);
        } catch (e) {
          console.error(`Address balance subscription callback error for address ${addressHex}: `, e);
        }
      });

      this.balanceSubscriptions.set(addressHex, balanceSubscription);
    }
  }

  private updateBalance(body: string) {
    const data = cotiParser(body);
    if (data.message === 'Balance Updated!') {
      const address = this.wallet.getAddressMap().get(data.addressHash);
      if (address === undefined) {
        const errorMsg = `Error - Address not found for addressHex: ${data.addressHash}`;
        console.log(errorMsg);
        throw new Error(errorMsg);
      }
      const { balance, preBalance } = data;
      this.setAddressWithBalance(address, balance === null ? 0 : balance, preBalance === null ? 0 : preBalance);
    }
  }

  private addressPropagationSubscriber(address: IndexedAddress) {
    console.log('Subscribing for address:', address.getAddressHex());
    const alreadySubscribed = this.propagationSubscriptions.get(address);
    const addressHex = address.getAddressHex();
    if (alreadySubscribed) {
      console.log('Attempting to resubscribe in address propagation, skip resubscription of:', addressHex);
    }

    let addressPropagationSubscription = this.client.subscribe(`/topic/address/${addressHex}`, async ({ body }) => {
      try {
        const data = cotiParser(body);
        console.log('Received an address through address propagation:', data.addressHash, ' index:', address.getIndex());
        if (data.addressHash !== addressHex) throw new Error('Error in addressPropagationSubscriber');

        const subscription = this.propagationSubscriptions.get(address);
        if (subscription) {
          subscription.unsubscribe();
          this.propagationSubscriptions.delete(address);
          this.wallet.emit('generateAddress', addressHex);
          await this.checkBalanceAndSubscribeNewAddress(address);
        }
      } catch (e) {
        console.error(`Propagation subscription callback error for address ${addressHex}: `, e);
      }
    });
    this.propagationSubscriptions.set(address, addressPropagationSubscription);
  }

  private async checkBalanceAndSubscribeNewAddress<T extends IndexedAddress>(address: IndexedAddress) {
    if (this.wallet instanceof IndexedWallet) {
      const nextPropagationAddressIndex = Array.from(this.propagationSubscriptions.keys()).pop().getIndex() + 1;
      const maxAddress = this.wallet.getMaxAddress();
      if (!maxAddress || nextPropagationAddressIndex < maxAddress) {
        const nextAddress = <T>await this.wallet.generateAddressByIndex(nextPropagationAddressIndex);
        this.addressPropagationSubscriber(nextAddress);
      }

      const addressHex = address.getAddressHex();

      const balances = await walletUtils.checkBalances([addressHex], this.wallet);
      const { addressBalance, addressPreBalance } = balances[addressHex];
      this.setAddressWithBalance(address, new BigDecimal(addressBalance), new BigDecimal(addressPreBalance));

      const addressIndex = address.getIndex();
      console.log(`Subscribing the balance and transactions for address: ${addressHex} and index: ${addressIndex}`);
      this.connectToAddress(addressHex);
    }
  }

  private setAddressWithBalance(address: BaseAddress, addressBalance: BigDecimal, addressPreBalance: BigDecimal) {
    this.wallet.setAddressWithBalance(address, addressBalance, addressPreBalance);
  }
}
