import { Network } from './utils/utils';
import { Transaction, TransactionData } from './transaction';
import { nodeUtils } from './utils/nodeUtils';
import {
  GetTransactionsHistoryByStampResDTO,
  GetTransactionsHistoryResDTO,
  SendTransactionResDTO
} from './dtos/nodeUtils.dto';
import { BalanceDto } from './dtos/balance.dto';

export class NodeClient {
  private readonly network: Network;
  private readonly fullnode?: string;

  constructor(network: Network = 'mainnet', fullnode?: string) {
    this.network = network;
    this.fullnode = fullnode;
  }

  async sendTransaction(transaction: Transaction): Promise<SendTransactionResDTO> {
    return nodeUtils.sendTransaction(transaction, this.network, this.fullnode);
  }

  async getTransaction(transactionHash: string): Promise<TransactionData> {
    return nodeUtils.getTransaction(transactionHash, this.network, this.fullnode);
  }

  async getTransactionsHistory(addresses: string[]): Promise<GetTransactionsHistoryResDTO> {
    return nodeUtils.getTransactionsHistory(addresses, this.network, this.fullnode);
  }

  async getTransactionHistoryByTimestamp(addresses: string[], startTime?: number, endTime?: number): Promise<GetTransactionsHistoryByStampResDTO> {
    return nodeUtils.getTransactionsHistoryByTimeStamp(addresses, this.network, this.fullnode, startTime, endTime);
  }

  async checkBalances(addresses: string[]): Promise<BalanceDto> {
    return nodeUtils.checkBalances(addresses, this.network, this.fullnode);
  }
}
