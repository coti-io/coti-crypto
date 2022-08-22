import { TransactionData } from '../transaction';
import { BaseTransactionData } from '../baseTransaction';

export type SendTransactionResDTO = {
  attachmentTime: number;
  message: string;
  status: string;
}

export type GetUserTrustScoreResDTO = {
  status: string;
  userHash: string;
  trustScore: number;
  userType: string;
}

export type SendAddressToNodeResDTO = {
  status: string;
  address: string;
  addressStatus: string;
}

export type CheckIfAddressExistsResDTO = {
  [key: string]: boolean
}

export type CheckBalancesResDTO = {
  [key: string]: {
    addressBalance: string;
    addressPreBalance: string;
  }
}

export type GetTransactionResDTO = {
  hash: string;
  amount: string;
  type: string;
  baseTransactions: BaseTransactionData[];
  leftParentHash:  string;
  rightParentHash: string;
  trustChainConsensus: number;
  trustChainTrustScore: number;
  transactionConsensusUpdateTime: number;
  createTime: number;
  attachmentTime: number;
  senderHash: string;
  senderTrustScore: number;
  childrenTransactionHashes: string;
  isValid: boolean | null;
  transactionDescription: string;
  index: number;
  status: string;
}

export type GetTransactionsHistoryResDTO = Map<string, TransactionData>

export type GetTransactionsHistoryByStampResDTO = Map<string, TransactionData>

export type TokenDetails = {
  currencyName: string;
  currencySymbol: string;
  currencyHash: string;
  description: string;
  totalSupply: string;
  scale: number;
  originatorHash: string;
  originatorSignature: {
    r: string;
    s: string;
  };
  createTime: '';
  currencyGeneratingTransactionHash: string;
  currencyLastTypeChangingTransactionHash: string;
  confirmed: boolean;
  currencyType: string;
  currencyRateSourceType: string;
  rateSource: string;
  protectionModel: string;
  mintedAmount: string;
  mintableAmount: string;
}

export type GetTokenDetailsResDTO = {
  status: string;
  token: TokenDetails
}
