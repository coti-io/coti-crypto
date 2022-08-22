import { SignatureData } from '../signature';

type WalletCurrency = {
  status: string;
  hash: string;
  name: string;
  symbol: string;
}

export type GetWalletCurrenciesResDto = {
  tokens: WalletCurrency[]
}

export type TokenMintingFeeQuoteResponse = {
  currencyHash: string;
  createTime: number;
  mintingAmount: number;
  mintingFee: number;
  signerHash: string;
  signature: SignatureData;
};
