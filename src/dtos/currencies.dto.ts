import { SignatureData } from '..';

export type TokenCurrency = {
  confirmed: boolean;
  createTime: Date;
  currencyGeneratingTransactionHash: string;
  currencyHash: string;
  currencyLastTypeChangingTransactionHash: string;
  currencyName: string;
  currencyRateSourceType: string; //TODO: find what are the possible values
  currencySymbol: string;
  currencyType: string; //TODO: find what are the possible values
  description: string;
  mintableAmount: number;
  originatorHash: string;
  originatorSignature: SignatureData;
  protectionModel: string;
  rateSource: string;
  scale: number;
  totalSupply: number;
};

export class TokenCurrenciesDto {
  userTokens: TokenCurrency[];

  constructor(tokenCurrenciesDto: TokenCurrenciesDto) {
    this.userTokens = tokenCurrenciesDto.userTokens;
  }
}
