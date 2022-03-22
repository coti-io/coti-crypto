import { Network } from './utils/utils';
import { Transaction } from './transaction';
import { nodeUtils } from './utils/nodeUtils';

export class NodeClient {
  private readonly network: Network;
  private readonly fullnode?: string;

  constructor(network: Network = 'mainnet', fullnode?: string) {
    this.network = network;
    this.fullnode = fullnode;
  }

  async sendTransaction(transaction: Transaction) {
    return nodeUtils.sendTransaction(transaction, this.network, this.fullnode);
  }

  async getTransaction(transactionHash: string) {
    return nodeUtils.getTransaction(transactionHash, this.network, this.fullnode);
  }

  async getTransactionsHistory(addresses: string[]) {
    return nodeUtils.getTransactionsHistory(addresses, this.network, this.fullnode);
  }

  async getTransactionHistoryByTimestamp(addresses: string[], startTime?: number, endTime?: number) {
    return nodeUtils.getTransactionsHistoryByTimeStamp(addresses, this.network, this.fullnode, startTime, endTime);
  }

  async checkBalances(addresses: string[]) {
    return nodeUtils.checkBalances(addresses, this.network, this.fullnode);
  }
}
