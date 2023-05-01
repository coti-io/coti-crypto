import { BigDecimal, getCurrencyHashBySymbol, Network } from './utils';
import * as cryptoUtils from './cryptoUtils';
import { FullNodeFeeSignature, TransactionTrustScoreSignature } from '../signature';
import { PrivateKey } from '../ecKeyPair';
import { nodeUtils } from './nodeUtils';
import { BaseTransaction, BaseTransactionData, BaseTransactionName } from '../baseTransaction';
import { Transaction, TransactionType } from '../transaction';
import { IndexedWallet } from '../wallet';
import { IndexedAddress } from '../address';
import moment from 'moment';
import { Balance, CotiBalanceDto, TokensBalanceDto } from '../dtos/balance.dto';
import { ec } from 'elliptic';

const amountRegex = /^\d+(\.\d{1,8})?$/;
const nativeCurrencyHash = getCurrencyHashBySymbol('coti');
type KeyPair = cryptoUtils.KeyPair;

export enum HardForks {
  SINGLE_CURRENCY,
  MULTI_CURRENCY,
}

/**
 * Creates a transaction for sending funds to a specified destination address.
 * @param {Object} parameterObject - An object containing parameters for creating the transaction.
 * @param {string} [parameterObject.userPrivateKey] - The user's private key.
 * @param {IndexedWallet} [parameterObject.wallet] - An indexed wallet object.
 * @param {Map<string, number>} parameterObject.inputMap - A map of input addresses and their corresponding amounts.
 * @param {string} [parameterObject.feeAddress] - The fee address.
 * @param {string} parameterObject.destinationAddress - The destination address.
 * @param {string} [parameterObject.description] - A description for the transaction.
 * @param {Network} [parameterObject.network] - The network to use for the transaction.
 * @param {string} [parameterObject.fullnode] - The full node to use for the transaction.
 * @param {string} [parameterObject.trustScoreNode] - The trust score node to use for the transaction.
 * @param {boolean} [parameterObject.feeIncluded=false] - Whether the fee is included in the transaction amount.
 * @param {string} [parameterObject.currencyHash] - The hash of the currency to use for the transaction.
 * @param {string} [parameterObject.originalCurrencyHash] - The hash of the original currency used for the transaction.
 * @param {HardForks} [parameterObject.hardFork=HardForks.SINGLE_CURRENCY] - The hard fork to use for the transaction.
 * @returns {Promise<Transaction>} A promise that resolves to the transaction object.
 * @throws {Error} Will throw an error if the fullnode does not support transfer of none native tokens.
 * @throws {Error} Will throw an error if trying to transfer a non-native token with feeIncluded set to true.
 * @throws {Error} Will throw an error if userPrivateKey or wallet is not defined.
 * @throws {Error} Will throw an error if the network parameter is not the same as the wallet network.
 * @throws {Error} Will throw an error if the fullnode parameter is not the same as the wallet fullnode.
 * @throws {Error} Will throw an error if the trustScoreNode parameter is not the same as the wallet trustScoreNode.
 * @throws {Error} Will throw an error if the fee address is missing or invalid.
 * @throws {Error} Will throw an error if the input address is invalid.
 * @throws {Error} Will throw an error if the input amount is invalid.
 * @throws {Error} Will throw an error if the input amount is not positive.
 * @throws {Error} Will throw an error if the fee address is not found in the inputs of a fee-included transaction.
 */
export async function createTransaction<T extends IndexedAddress>(parameterObject: {
  userPrivateKey?: string;
  wallet?: IndexedWallet<T>;
  inputMap: Map<string, number>;
  feeAddress?: string;
  destinationAddress: string;
  description?: string;
  network?: Network;
  fullnode?: string;
  trustScoreNode?: string;
  feeIncluded?: boolean;
  currencyHash?: string;
  originalCurrencyHash?: string;
  hardFork?: HardForks;
}) {
  const {
    userPrivateKey,
    wallet,
    inputMap,
    feeAddress,
    destinationAddress,
    description,
    feeIncluded = false,
    currencyHash,
    originalCurrencyHash,
  } = parameterObject;
  let { network, fullnode, trustScoreNode, hardFork = HardForks.SINGLE_CURRENCY } = parameterObject;

  if (hardFork === HardForks.SINGLE_CURRENCY && (currencyHash || originalCurrencyHash)) {
    throw new Error('Fullnode should support transfer of none native tokens.');
  }

  if (feeIncluded && currencyHash) {
    throw new Error('Should fail when trying to transfer token which is not native with feeIncluded true.');
  }

  if (!userPrivateKey && !wallet) throw new Error('UserPrivateKey or wallet should be defined');

  if (network && wallet && wallet.getNetwork() !== network) throw new Error('Network parameter should be the same as wallet network');
  if (wallet) network = wallet.getNetwork();

  if (fullnode && wallet && wallet.getFullNode() !== fullnode) throw new Error('Fullnode parameter should be the same as wallet fullnode');
  if (wallet) fullnode = wallet.getFullNode();

  if (trustScoreNode && wallet && wallet.getTrustScoreNode() !== trustScoreNode)
    throw new Error('TrustScoreNode parameter should be the same as wallet trustScoreNode');
  if (wallet) trustScoreNode = wallet.getTrustScoreNode();

  if (!feeIncluded) {
    if (!feeAddress) throw new Error(`Missing fee address`);
    if (!cryptoUtils.verifyAddressStructure(feeAddress)) throw new Error(`Invalid fee address: ${feeAddress}`);
  }
  let feeAddressInInputMap = !feeAddress || inputMap.has(feeAddress);
  if (feeIncluded && !feeAddressInInputMap) throw new Error(`Fee address not found in inputs of fee included transaction`);

  let originalAmount = new BigDecimal('0');
  let addresses = [];

  inputMap.forEach((amount, address) => {
    if (!cryptoUtils.verifyAddressStructure(address)) throw new Error(`Invalid address: ${address}`);
    const decimalAmount = new BigDecimal(amount.toString());
    if (!amountRegex.test(decimalAmount.toPlainString())) throw new Error(`Invalid amount ${amount} for address ${address}`);
    if (decimalAmount.compareTo(new BigDecimal('0')) <= 0) throw new Error(`Error sending transaction - input amount should be positive`);
    originalAmount = originalAmount.add(decimalAmount);
    addresses.push(address);
  });
  if (!feeIncluded && !feeAddressInInputMap) addresses.push(feeAddress!);

  const balanceObject = await nodeUtils.checkBalances(addresses, network, fullnode);
  const tokensBalanceObject = hardFork === HardForks.MULTI_CURRENCY ? await nodeUtils.getTokenBalances(addresses, network, fullnode) : undefined;

  let keyPair: KeyPair | undefined;
  let userHash: string;
  if (userPrivateKey) {
    const privateKey = new PrivateKey(userPrivateKey);

    keyPair = privateKey.keyPair;
    userHash = privateKey.getPublicKey();
  } else {
    userHash = wallet!.getPublicHash();
  }

  let { fullNodeFee, networkFee } = await getFees(
    originalAmount,
    userHash!,
    keyPair,
    wallet,
    feeIncluded,
    network,
    fullnode,
    trustScoreNode,
    currencyHash
  );
  const baseTransactions: BaseTransaction[] = [];
  const feeAmount = new BigDecimal(fullNodeFee.amount.toString()).add(new BigDecimal(networkFee.amount.toString()));

  if (!feeIncluded) {
    if (feeAddressInInputMap) {
      if (currencyHash && currencyHash !== nativeCurrencyHash) {
        addInputBaseTransaction(balanceObject, feeAddress!, Number(feeAmount), baseTransactions, nativeCurrencyHash);
      } else {
        const amount = inputMap.get(feeAddress!)!;
        const feeIncludedAmount = feeAmount.add(new BigDecimal(amount.toString()));

        inputMap.set(feeAddress!, Number(feeIncludedAmount.toString()));
      }
    } else inputMap.set(feeAddress!, Number(feeAmount.stripTrailingZeros().toString()));
  }

  inputMap.forEach((amount, address) => {
    let tokenHash = currencyHash;
    if (hardFork !== HardForks.SINGLE_CURRENCY && amount === Number(feeAmount) && address === feeAddress) {
      tokenHash = nativeCurrencyHash;
    }
    addInputBaseTransaction(balanceObject, address, amount, baseTransactions, tokenHash, tokensBalanceObject);
  });
  networkFee = await nodeUtils.createMiniConsensus(userHash!, fullNodeFee, networkFee, network, trustScoreNode);

  addOutputBaseTransactions(originalAmount, fullNodeFee, networkFee, destinationAddress, baseTransactions, feeIncluded, currencyHash);

  const transaction = new Transaction(baseTransactions, description, userHash!);

  await addTrustScoreToTransaction(transaction, userHash!, keyPair, wallet, network, trustScoreNode);

  return transaction;
}

/**
 Asynchronously generates a signature for a full node fee.
 @param {string} originalAmount - The original amount of the transaction.
 @param {KeyPair | undefined} keyPair - The key pair used to sign the transaction.
 @param {IndexedWallet<T> | undefined} wallet - The indexed wallet used to sign the transaction.
 @param {string | undefined} currencyHash - The currency hash used to sign the transaction.
 @returns {Promise<string>} - The generated signature.
 */
async function getFullNodeFeeSignature<T extends IndexedAddress>(
  originalAmount: string,
  keyPair?: KeyPair,
  wallet?: IndexedWallet<T>,
  currencyHash?: string
) {
  const fullNodeFeeSignature = new FullNodeFeeSignature(originalAmount, currencyHash);

  return keyPair ? fullNodeFeeSignature.signByKeyPair(keyPair) : fullNodeFeeSignature.sign(wallet!);
}


/**
 * Get full node and network fees for a given amount and user.
 * @template T
 * @param {BigDecimal} originalAmount - The original amount to calculate fees for.
 * @param {string} userHash - The user public hash to calculate fees for.
 * @param {KeyPair} [keyPair] - The key pair to use for signing the full node fee.
 * @param {IndexedWallet<T>} [wallet] - The wallet to use for signing the full node fee.
 * @param {boolean} [feeIncluded] - Whether the fees are already included in the amount.
 * @param {Network} [network] - The network to use for calculating fees.
 * @param {string} [fullnode] - The full node to use for calculating fees.
 * @param {string} [trustScoreNode] - The trust score node to use for calculating fees.
 * @param {string} [currencyHash] - The currency hash to use for calculating fees.
 * @returns {Promise<{ fullNodeFee: BaseTransactionData, networkFee: BaseTransactionData }>} - The full node and network fees base transactions.
 */
async function getFees<T extends IndexedAddress>(
  originalAmount: BigDecimal,
  userHash: string,
  keyPair?: KeyPair,
  wallet?: IndexedWallet<T>,
  feeIncluded?: boolean,
  network?: Network,
  fullnode?: string,
  trustScoreNode?: string,
  currencyHash?: string
): Promise<{fullNodeFee: BaseTransactionData, networkFee: BaseTransactionData}> {
  const originalAmountString = originalAmount.toString();
  const fullNodeFeeSignature = await getFullNodeFeeSignature(originalAmountString, keyPair, wallet, currencyHash);
  const fullNodeFee = await nodeUtils.getFullNodeFees(
    originalAmountString,
    userHash,
    fullNodeFeeSignature,
    network,
    feeIncluded,
    fullnode,
    currencyHash
  );
  const networkFee = await nodeUtils.getNetworkFees(fullNodeFee, userHash, network, feeIncluded, trustScoreNode);

  return { fullNodeFee, networkFee };
}

/**
 Adds a base transaction to the given base transactions array for an input from the given address.
 @param {CotiBalanceDto} balanceObject - An object containing the balance and pre-balance of each address.
 @param {string} address - The address from which the input is coming.
 @param {number} amount - The amount of the input transaction.
 @param {array} baseTransactions - An array of base transactions.
 @param {string} [currencyHash] - An optional currency hash.
 @param {TokensBalanceDto} [tokensBalanceObject] - An optional object containing token balances for each address.
 @returns {void}
 */
function addInputBaseTransaction(
  balanceObject: CotiBalanceDto,
  address: string,
  amount: number,
  baseTransactions: BaseTransaction[],
  currencyHash?: string,
  tokensBalanceObject?: TokensBalanceDto
): void {
  let balance;
  let preBalance;
  let addressBalance;
  let addressPreBalance;

  if (currencyHash && tokensBalanceObject && currencyHash !== nativeCurrencyHash) {
    let tokenBalance = tokensBalanceObject[address] ? tokensBalanceObject[address][currencyHash] : undefined;

    if (!tokenBalance) {
      tokenBalance = { addressBalance: 0, addressPreBalance: 0 };
    }

    addressBalance = tokenBalance.addressBalance;
    addressPreBalance = tokenBalance.addressPreBalance;
  } else {
    addressBalance = balanceObject[address].addressBalance;
    addressPreBalance = balanceObject[address].addressPreBalance;
  }

  balance = new BigDecimal(`${addressBalance}`);
  preBalance = new BigDecimal(`${addressPreBalance}`);

  const addressMaxAmount = preBalance.compareTo(balance) < 0 ? preBalance : balance;
  const decimalAmount = new BigDecimal(amount.toString());

  if (addressMaxAmount.compareTo(decimalAmount) < 0)
    throw new Error(
      `Error at create transaction - Trying to send ${decimalAmount}, current balance is ${addressMaxAmount}. Not enough balance in address: ${address}`
    );
  const spendFromAddress = decimalAmount.multiply(new BigDecimal('-1'));

  baseTransactions.push(new BaseTransaction(address, spendFromAddress, BaseTransactionName.INPUT, undefined, undefined, undefined, currencyHash));
}

/**
 Adds output base transactions to an array of base transactions for a COTI transaction.
 @param {BigDecimal} originalAmount - The original amount of the transaction.
 @param {BaseTransactionData} fullNodeFee - The full node fee data.
 @param {BaseTransactionData} networkFee - The network fee data.
 @param {string} destinationAddress - The destination address for the transaction.
 @param {BaseTransaction[]} baseTransactions - The array of base transactions to add to.
 @param {boolean} feeIncluded - Whether the fees are already included in the amount.
 @param {string} [currencyHash] - The currency hash for the transaction, if any.
 @returns {void}
 */
function addOutputBaseTransactions(
  originalAmount: BigDecimal,
  fullNodeFee: BaseTransactionData,
  networkFee: BaseTransactionData,
  destinationAddress: string,
  baseTransactions: BaseTransaction[],
  feeIncluded: boolean,
  currencyHash?: string
): void {
  const amountRBT = feeIncluded
    ? originalAmount.subtract(new BigDecimal(fullNodeFee.amount)).subtract(new BigDecimal(networkFee.amount))
    : originalAmount;

  const RBT = new BaseTransaction(
    destinationAddress,
    amountRBT,
    BaseTransactionName.RECEIVER,
    undefined,
    undefined,
    originalAmount,
    currencyHash,
    undefined,
    currencyHash
  );
  const fullNodeTransactionFee = BaseTransaction.getBaseTransactionFromFeeData(fullNodeFee);
  const transactionNetworkFee = BaseTransaction.getBaseTransactionFromFeeData(networkFee);

  baseTransactions.push(fullNodeTransactionFee);
  baseTransactions.push(transactionNetworkFee);
  baseTransactions.push(RBT);
}

/**
 Generates a transaction trust score signature for a given transaction hash.
 @async
 @param {string} transactionHash - The hash of the transaction to generate the signature for.
 @param {KeyPair} [keyPair] - The key pair to use for signing. If provided, will sign the signature using the key pair.
 @param {IndexedWallet<T>} [wallet] - The indexed wallet to use for signing. If provided, will sign the signature using the wallet.
 @returns {Promise<ec.SignatureOptions>} - A Promise that resolves to ec.SignatureOptions.
 */
async function getTransactionTrustScoreSignature<T extends IndexedAddress>(transactionHash: string, keyPair?: KeyPair, wallet?: IndexedWallet<T>): Promise<ec.SignatureOptions> {
  const transactionTrustScoreSignature = new TransactionTrustScoreSignature(transactionHash);

  return keyPair ? transactionTrustScoreSignature.signByKeyPair(keyPair, true) : transactionTrustScoreSignature.sign(wallet!, true);
}

/**
 * Adds trust score information to a transaction and returns the updated transaction.
 * @param {Transaction} transaction - The transaction to add trust score information to.
 * @param {string} userHash - The user public hash to be used to retrieve trust score data.
 * @param {KeyPair=} keyPair - The key pair to sign the transaction trust score signature. If not provided, a wallet must be specified.
 * @param {IndexedWallet<T>=} wallet - The wallet containing the address to sign the transaction trust score signature. If not provided, a key pair must be specified.
 * @param {Network=} network - The network to use to retrieve trust score data. Defaults to the `MAINNET` network.
 * @param {string=} trustScoreNode - The trust score node URL to use to retrieve trust score data. Defaults to the default trust score node URL.
 * @returns {Promise<void>}
 */
export async function addTrustScoreToTransaction<T extends IndexedAddress>(
  transaction: Transaction,
  userHash: string,
  keyPair?: KeyPair,
  wallet?: IndexedWallet<T>,
  network?: Network,
  trustScoreNode?: string
): Promise<void> {
  const transactionHash = transaction.getHash();
  const transactionTrustScoreSignature = await getTransactionTrustScoreSignature(transactionHash, keyPair, wallet);
  const transactionTrustScoreData = await nodeUtils.getTrustScoreForTransaction(
    transactionHash,
    userHash,
    transactionTrustScoreSignature,
    network,
    trustScoreNode
  );

  transaction.addTrustScoreMessageToTransaction(transactionTrustScoreData);
}

/**
 * Generates a transaction for token generation.
 * @param {Object} params - The parameters for generating the transaction.
 * @param {BaseTransactionData} params.feeBT - The base transaction data for the fee.
 * @param {BaseTransactionData} params.fullnodeFee - The base transaction data for the fullnode fee.
 * @param {string} params.walletAddressIBT - The destination address for the IBT transaction.
 * @param {string} params.userHash - The user public hash for the transaction.
 * @param {TransactionType} params.transactionType - The transaction type.
 * @param {string} params.transactionDescription - The description of the transaction.
 * @returns {Transaction} The generated transaction.
 */
export async function transactionTokenGeneration(params: {
  feeBT: BaseTransactionData;
  fullnodeFee: BaseTransactionData;
  walletAddressIBT: string;
  userHash: string;
  transactionType: TransactionType;
  transactionDescription: string;
}) {
  const { feeBT, fullnodeFee, walletAddressIBT, userHash, transactionType, transactionDescription } = params;
  const instantTimeUnix = moment.utc().unix();
  const tokenGenerationFee = new BigDecimal(feeBT.amount);
  const fullNodeFeeAmount = new BigDecimal(fullnodeFee.amount);
  const fullAmount = tokenGenerationFee.add(fullNodeFeeAmount);
  const IBT_amount = parseFloat(fullAmount.toString()) * -1;
  const IBTAmountBD = new BigDecimal(IBT_amount);
  const IBT_Transaction = new BaseTransaction(
    walletAddressIBT,
    IBTAmountBD,
    BaseTransactionName.INPUT,
    undefined,
    undefined,
    fullAmount,
    fullnodeFee.currencyHash,
    instantTimeUnix
  );
  const fullNodeFeeBaseTransaction = BaseTransaction.getBaseTransactionFromFeeData(fullnodeFee);
  const tokenGenerationFeeBaseTransaction = BaseTransaction.getBaseTransactionFromFeeData(feeBT);
  const baseTransaction = [IBT_Transaction, fullNodeFeeBaseTransaction, tokenGenerationFeeBaseTransaction];
  return new Transaction(baseTransaction, transactionDescription, userHash, transactionType, true, instantTimeUnix);
}
