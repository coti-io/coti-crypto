import * as utils from './utils/utils';
import * as cryptoUtils from './utils/cryptoUtils';
import * as transactionUtils from './utils/transactionUtils';
import axios from 'axios';
import { replaceNumberToStringByKeyJsonParser } from './utils/utils';

axios.defaults.transformResponse = (response: string) => {
  const map = new Map<string, boolean>();
  map.set('mintingAmount', false);
  map.set('amount', false);
  map.set('originalAmount', false);
  map.set('feeAmount', false);
  map.set('reducedAmount', false);
  const parsedResponse = replaceNumberToStringByKeyJsonParser(response, map);
  return JSON.parse(parsedResponse);
};

export { utils, cryptoUtils, transactionUtils };
export { BigDecimal } from './utils/utils';
export { walletUtils } from './utils/walletUtils';
export { nodeUtils } from './utils/nodeUtils';
export { tokenUtils } from './utils/tokenUtils';
export { financeUtils } from './utils/financeUtils';
export * from './utils/avatar';
export * from './nodeClient';
export * from './ecKeyPair';
export * from './ledgerDevice';
export * from './address';
export * from './baseTransaction';
export * from './transaction';
export * from './signature';
export * from './wallet';
export * from './webSocket';

