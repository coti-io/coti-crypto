import { Network } from './utils/utils';
import { Transaction } from './transaction';
import { nodeUtils } from './utils/nodeUtils';

export class NodeClient {
  readonly network: Network;

  constructor(network: Network = 'mainnet') {
    this.network = network;
  }

  async sendTransaction(transaction: Transaction) {
    return await nodeUtils.sendTransaction(transaction, this.network);
  }

  async getTransaction(transactionHash: string) {
    return await nodeUtils.getTransaction(transactionHash, this.network);
  }

  async getTransactionsHistory(addresses: string[]) {
    return await nodeUtils.getTransactionsHistory(addresses, this.network);
  }

  async checkBalances(addresses: string[]) {
    return await nodeUtils.checkBalances(addresses, this.network);
  }
}
