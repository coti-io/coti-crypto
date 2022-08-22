import { BaseTransactionData, BaseTransactionName, Item, TrustScoreNodeResult } from '../baseTransaction';
import * as utils from '../utils/utils';
import { ServiceData } from '../transaction';
import { SignatureData } from '../signature';
import { BigDecimal } from '../utils/utils';

export type GetFeesResDTO = {
  fullNodeFee: BaseTransactionData;
  networkFee: BaseTransactionData;
}

export type BaseTransactionToJSON = {
  hash: string;
  currencyHash?: string;
  addressHash: string;
  amount: string;
  createTime: number;
  serviceData?: ServiceData;
  name: BaseTransactionName;
  items?: Item[];
  encryptedMerchantName?: string;
  originalAmount?: string;
  networkFeeTrustScoreNodeResult?: TrustScoreNodeResult[];
  rollingReserveTrustScoreNodeResult?: TrustScoreNodeResult[];
  receiverDescription?: string;
  reducedAmount?: string;
  signatureData?: SignatureData;
  signerHash?: string;
  originalCurrencyHash?: string;
}