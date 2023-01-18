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

const amountRegex = /^\d+(\.\d{1,8})?$/;
const nativeCurrencyHash = getCurrencyHashBySymbol('coti');
type KeyPair = cryptoUtils.KeyPair;

export enum HardForks {
  SINGLE_CURRENCY,
  MULTI_CURRENCY,
}

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

  addOutputBaseTransactions(
    originalAmount,
    fullNodeFee,
    networkFee,
    destinationAddress,
    baseTransactions,
    feeIncluded,
    currencyHash,
    originalCurrencyHash
  );

  const transaction = new Transaction(baseTransactions, description, userHash!);

  await addTrustScoreToTransaction(transaction, userHash!, keyPair, wallet, network, trustScoreNode);

  return transaction;
}

async function getFullNodeFeeSignature<T extends IndexedAddress>(
  originalAmount: string,
  keyPair?: KeyPair,
  wallet?: IndexedWallet<T>,
  currencyHash?: string
) {
  const fullNodeFeeSignature = new FullNodeFeeSignature(originalAmount, currencyHash);

  return keyPair ? fullNodeFeeSignature.signByKeyPair(keyPair) : fullNodeFeeSignature.sign(wallet!);
}

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
) {
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

function addInputBaseTransaction(
  balanceObject: any,
  address: string,
  amount: number,
  baseTransactions: BaseTransaction[],
  currencyHash?: string,
  tokensBalanceObject?: any
) {
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

function addOutputBaseTransactions(
  originalAmount: BigDecimal,
  fullNodeFee: BaseTransactionData,
  networkFee: BaseTransactionData,
  destinationAddress: string,
  baseTransactions: BaseTransaction[],
  feeIncluded: boolean,
  currencyHash?: string,
  originalCurrencyHash?: string
) {
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
    originalCurrencyHash
  );
  const fullNodeTransactionFee = BaseTransaction.getBaseTransactionFromFeeData(fullNodeFee);
  const transactionNetworkFee = BaseTransaction.getBaseTransactionFromFeeData(networkFee);

  baseTransactions.push(fullNodeTransactionFee);
  baseTransactions.push(transactionNetworkFee);
  baseTransactions.push(RBT);
}

async function getTransactionTrustScoreSignature<T extends IndexedAddress>(transactionHash: string, keyPair?: KeyPair, wallet?: IndexedWallet<T>) {
  const transactionTrustScoreSignature = new TransactionTrustScoreSignature(transactionHash);

  return keyPair ? transactionTrustScoreSignature.signByKeyPair(keyPair, true) : transactionTrustScoreSignature.sign(wallet!, true);
}

export async function addTrustScoreToTransaction<T extends IndexedAddress>(
  transaction: Transaction,
  userHash: string,
  keyPair?: KeyPair,
  wallet?: IndexedWallet<T>,
  network?: Network,
  trustScoreNode?: string
) {
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
