import bigdecimal from 'bigdecimal';
import * as stomp from 'webstomp-client';
import SockJS from 'sockjs-client';
import { checkBalances } from './utils/walletUtils';
import { Address } from './address';
import { WalletEvent } from './walletEvent';
import { Wallet } from './wallet';
import { BaseAddress } from './baseAddress';
import { IndexedAddress } from './indexedAddress';

const FULL_NODE_WEBSOCKET_ACTION = '/websocket';
const FULL_NODE_URL = process.env.FULL_NODE_URL;
const socketUrl = FULL_NODE_URL + FULL_NODE_WEBSOCKET_ACTION;

export type StompClient = stomp.Client;

export class WebSocket {
  private readonly wallet: Wallet;
  private client!: StompClient;
  private reconnectCounter = 0;
  private readonly propagationSubscriptions = new Map();
  private readonly balanceSubscriptions = new Map();
  private readonly transactionsSubscriptions = new Map();

  constructor(wallet: Wallet, successCallback: () => void, reconnectFailedCallback: () => void) {
    this.wallet = wallet;
    this.openWebSocketConnection(wallet, successCallback, reconnectFailedCallback);
  }

  public openWebSocketConnection(wallet: Wallet, successCallback: () => void, reconnectFailedCallback: () => void) {
    const addresses = wallet.getWalletAddressHexes();
    this.setClient();
    this.client.connect(
      {},
      () => {
        console.info('Web socket client connected:');
        onConnected(addresses, successCallback);
      },
      error => {
        console.error(error);
        addressesUnsubscribe();
        this.reconnect(socketUrl, successCallback, reconnectFailedCallback, addresses);
      }
    );
  }

  private setClient() {
    const ws = new SockJS(socketUrl);
    this.client = stomp.over(ws);
  }

  private closeSocketConnection() {
    addressesUnsubscribe();
    this.client.disconnect();
  }

  private async addressesUnsubscribe() {
    this.propagationSubscriptions.forEach(async propagationSubscription => await propagationSubscription.unsubscribe());
    this.balanceSubscriptions.forEach(async balanceSubscription => await balanceSubscription.unsubscribe());
    this.transactionsSubscriptions.forEach(
      async transactionsSubscription => await transactionsSubscription.unsubscribe()
    );
  }

  private reconnect(
    socketUrl: string,
    successCallback: () => void,
    reconnectFailedCallback: () => void,
    addresses: string[]
  ) {
    let connected = false;

    this.setClient();
    this.client.connect(
      {},
      () => {
        console.info('Web socket client reconnected:');
        connected = true;
        this.onConnected(addresses, successCallback);
      },
      () => {
        if (!connected && this.reconnectCounter <= 6) {
          console.log('Web socket trying to reconnect. Counter: ', this.reconnectCounter);
          this.reconnectCounter++;
          this.reconnect(socketUrl, successCallback, reconnectFailedCallback, addresses);
        } else {
          console.log('Web socket client reconnect unsuccessful');
          reconnectFailedCallback();
        }
      }
    );
  }

  private onConnected(addresses: string[], callback: () => void) {
    this.reconnectCounter = 0;
    console.log('Connected and monitoring addresses: ', addresses);
    if (!addresses) addresses = [];

    addresses.forEach(address => {
      this.connectToAddress(address);
    });

    for (let i = addresses.length; i < addresses.length + 10; i++) {
      const keyPair = this.wallet.getKeyPairFromAddressIndex(i);
      const address = new Address(keyPair, i);
      this.addressPropagationSubscriber(address);
    }
    console.log(
      'PropagationSubscriptions: ',
      [...this.propagationSubscriptions.keys()].map(a => a.getAddressHex())
    );
    console.log('BalanceSubscriptions: ', [...this.balanceSubscriptions.keys()]);
    console.log('TransactionsSubscriptions: ', [...this.transactionsSubscriptions.keys()]);

    if (callback) return callback();
  }

  private connectToAddress(addressHex: string) {
    if (!this.balanceSubscriptions.get(addressHex)) {
      let balanceSubscription = this.client.subscribe(`/topic/${addressHex}`, async ({ body }) => {
        try {
          const data = JSON.parse(body);
          if (data.message === 'Balance Updated!') {
            const address = this.wallet.getWalletAddresses().get(data.addressHash);
            if (address === undefined) {
              const errorMsg = `Error - Address not found for addressHex: ${data.addressHash}`;
              console.log(errorMsg);
              throw new Error(errorMsg);
            }
            const { balance, preBalance } = data;
            this.setAddressWithBalance(balance === null ? 0 : balance, preBalance === null ? 0 : preBalance, address);
          }
        } catch (error) {
          console.log(error);
        }
      });

      this.balanceSubscriptions.set(addressHex, balanceSubscription);
    }

    if (!this.transactionsSubscriptions.get(addressHex)) {
      let transactionSubscription = this.client.subscribe(
        `/topic/addressTransactions/${addressHex}`,
        async ({ body }) => {
          try {
            const data = JSON.parse(body);
            const { transactionData } = data;
            transactionData.createTime = new Date(transactionData.createTime).getTime();
            if (transactionData.transactionConsensusUpdateTime) {
              transactionData.transactionConsensusUpdateTime = new Date(
                transactionData.transactionConsensusUpdateTime
              ).getTime();
            }
            this.wallet.setTransaction(transactionData);
          } catch (error) {
            console.log(error);
          }
        }
      );

      this.transactionsSubscriptions.set(addressHex, transactionSubscription);
    }
  }

  addressPropagationSubscriber(address: IndexedAddress) {
    console.log('Subscribing for address:', address.getAddressHex());
    const alreadySubscribed = this.propagationSubscriptions.get(address);
    const addressHex = address.getAddressHex();
    if (alreadySubscribed) {
      console.log('Attempting to resubscribe in address propagation, skip resubscription of:', address.getAddressHex());
    }

    let addressPropagationSubscription = this.client.subscribe(`/topic/address/${addressHex}`, ({ body }) => {
      try {
        const data = JSON.parse(body);
        console.log(
          'Received an address through address propagation:',
          data.addressHash,
          ' index:',
          address.getIndex()
        );
        if (data.addressHash !== addressHex) throw new Error('Error in addressPropagationSubscriber');

        const subscription = this.propagationSubscriptions.get(address);
        if (subscription) {
          subscription.unsubscribe();
          this.propagationSubscriptions.delete(address);
          this.checkBalanceAndSubscribeNewAddress(address);
          this.wallet.onGenerateAddress(addressHex);
        }
      } catch (err) {
        if (err) {
          console.log('Error: ', err);
        }
      }
    });
    this.propagationSubscriptions.set(address, addressPropagationSubscription);
  }

  async checkBalanceAndSubscribeNewAddress(address: IndexedAddress) {
    const nextPropagationAddressIndex = Array.from(this.propagationSubscriptions.keys()).pop().index + 1;
    const keyPair = this.wallet.getKeyPairFromAddressIndex(nextPropagationAddressIndex);
    const nextAddress = new Address(keyPair, nextPropagationAddressIndex);

    this.addressPropagationSubscriber(nextAddress);

    const addressHex = address.getAddressHex();

    const balances = await checkBalances([addressHex]);
    const { addressBalance, addressPreBalance } = balances[addressHex];
    this.setAddressWithBalance(addressBalance, addressPreBalance, address);

    const addressIndex = address.getIndex();
    console.log(`Subscribing the balance and transactions for address: ${addressHex} and index: ${addressIndex}`);
    this.connectToAddress(addressHex);
  }

  setAddressWithBalance(addressBalance: number, addressPreBalance: number, address: BaseAddress) {
    addressBalance = new bigdecimal.BigDecimal(`${addressBalance}`);
    addressPreBalance = new bigdecimal.BigDecimal(`${addressPreBalance}`);

    this.wallet.setAddressWithBalance(address, addressBalance, addressPreBalance);
  }
}
