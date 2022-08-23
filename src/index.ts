import * as utils from './utils/utils';
import * as cryptoUtils from './utils/cryptoUtils';
import * as transactionUtils from './utils/transactionUtils';
import axios from 'axios';
import { cotiParser } from './utils/jsonUtils';

axios.defaults.transformResponse = (response: string): any => {
  return cotiParser(response);
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
