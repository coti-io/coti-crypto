import * as utils from './utils/utils';
import * as cryptoUtils from './utils/cryptoUtils';
import * as transactionUtils from './utils/transactionUtils';
import axios from 'axios';
import { JsonUtils, JsonUtilsOptions } from './utils/jsonUtils';

axios.defaults.transformResponse = (response: string) => {
  const map = new Map<string, boolean>();
  map.set('mintingAmount', true);
  map.set('amount', true);
  map.set('originalAmount', true);
  map.set('feeAmount', true);
  map.set('reducedAmount', true);
  const jsonUtilsOptions: JsonUtilsOptions = { keyList: map };
  const jsonUtils = new JsonUtils(jsonUtilsOptions);
  const parser = jsonUtils.parse();
  return parser(response);
};

export { utils, cryptoUtils, transactionUtils };
export { BigDecimal } from './utils/utils';
export { walletUtils } from './utils/walletUtils';
export { nodeUtils } from './utils/nodeUtils';
export { tokenUtils } from './utils/tokenUtils';
export { financeUtils } from './utils/financeUtils';
export { JsonUtils, JsonUtilsOptions } from './utils/jsonUtils';
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
