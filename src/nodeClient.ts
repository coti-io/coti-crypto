import { Network } from './utils/utils';
import { Transaction } from './transaction';
import { nodeUtils } from './utils/nodeUtils';

export class NodeClient {
  private readonly network: Network;
  private fullnode?: string;

  constructor(network: Network = 'mainnet', fullnode?: string) {
    this.network = network;
    this.fullnode = fullnode;
  }

  async sendTransaction(transaction: Transaction) {
    return await nodeUtils.sendTransaction(transaction, this.network, this.fullnode);
  }

  async getTransaction(transactionHash: string) {
    return await nodeUtils.getTransaction(transactionHash, this.network, this.fullnode);
  }

  async getTransactionsHistory(addresses: string[]) {
    return await nodeUtils.getTransactionsHistory(addresses, this.network, this.fullnode);
  }

  async checkBalances(addresses: string[]) {
    return await nodeUtils.checkBalances(addresses, this.network, this.fullnode);
  }
}
