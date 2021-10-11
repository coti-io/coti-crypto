import { BigDecimal, Network } from './utils';
import * as cryptoUtils from './cryptoUtils';
import { FullNodeFeeSignature, TransactionTrustScoreSignature } from '../signature';
import { PrivateKey } from '../ecKeyPair';
import { nodeUtils } from './nodeUtils';
import { BaseTransaction, BaseTransactionName, BaseTransactionData } from '../baseTransaction';
import { Transaction } from '../transaction';
import { IndexedWallet } from '../wallet';
import { IndexedAddress } from '../address';

const amountRegex = /^\d+(\.\d{1,8})?$/;

type KeyPair = cryptoUtils.KeyPair;

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
}) {
  const { userPrivateKey, wallet, inputMap, feeAddress, destinationAddress, description, feeIncluded = false } = parameterObject;
  let { network, fullnode, trustScoreNode } = parameterObject;

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
    if (!amountRegex.test(amount.toString())) throw new Error(`Invalid amount ${amount} for address ${address}`);
    const decimalAmount = new BigDecimal(amount.toString());
    if (decimalAmount.compareTo(new BigDecimal('0')) <= 0) throw new Error(`Error sending transaction - input amount should be positive`);
    originalAmount = originalAmount.add(decimalAmount);
    amount = Number(decimalAmount.stripTrailingZeros().toString());
    addresses.push(address);
  });
  if (!feeIncluded && !feeAddressInInputMap) addresses.push(feeAddress!);

  const balanceObject = await nodeUtils.checkBalances(addresses, network, fullnode);

  originalAmount = originalAmount.stripTrailingZeros();

  let keyPair: KeyPair | undefined;
  let userHash: string;
  if (userPrivateKey) {
    const privateKey = new PrivateKey(userPrivateKey);
    keyPair = privateKey.keyPair;
    userHash = privateKey.getPublicKey();
  } else {
    userHash = wallet!.getPublicHash();
  }

  let { fullNodeFee, networkFee } = await getFees(originalAmount, userHash!, keyPair, wallet, feeIncluded, network, fullnode, trustScoreNode);

  if (!feeIncluded) {
    const feeAmount = new BigDecimal(fullNodeFee.amount.toString()).add(new BigDecimal(networkFee.amount.toString()));
    if (feeAddressInInputMap) {
      const amount = inputMap.get(feeAddress!)!;
      const feeIncludedAmount = feeAmount.add(new BigDecimal(amount.toString())).stripTrailingZeros();
      inputMap.set(feeAddress!, Number(feeIncludedAmount.toString()));
    } else inputMap.set(feeAddress!, Number(feeAmount.stripTrailingZeros().toString()));
  }

  let baseTransactions: BaseTransaction[] = [];

  inputMap.forEach((amount, address) => {
    addInputBaseTranction(balanceObject, address, amount, baseTransactions);
  });

  networkFee = await nodeUtils.createMiniConsensus(userHash!, fullNodeFee, networkFee, network, trustScoreNode);

  addOutputBaseTransactions(originalAmount, fullNodeFee, networkFee, destinationAddress, baseTransactions, feeIncluded);

  const transaction = new Transaction(baseTransactions, description, userHash!);

  await addTrustScoreToTransaction(transaction, userHash!, keyPair, wallet, network, trustScoreNode);

  return transaction;
}

async function getFullNodeFeeSignature<T extends IndexedAddress>(originalAmount: number, keyPair?: KeyPair, wallet?: IndexedWallet<T>) {
  const fullNodeFeeSignature = new FullNodeFeeSignature(originalAmount);
  return keyPair ? fullNodeFeeSignature.signByKeyPair(keyPair) : await fullNodeFeeSignature.sign(wallet!);
}

async function getFees<T extends IndexedAddress>(
  originalAmount: BigDecimal,
  userHash: string,
  keyPair?: KeyPair,
  wallet?: IndexedWallet<T>,
  feeIncluded?: boolean,
  network?: Network,
  fullnode?: string,
  trustScoreNode?: string
) {
  const originalAmountInNumber = Number(originalAmount.toString());
  const fullNodeFeeSignature = await getFullNodeFeeSignature(originalAmountInNumber, keyPair, wallet);
  const fullNodeFee = await nodeUtils.getFullNodeFees(originalAmountInNumber, userHash, fullNodeFeeSignature, network, feeIncluded, fullnode);
  const networkFee = await nodeUtils.getNetworkFees(fullNodeFee, userHash, network, feeIncluded, trustScoreNode);
  return { fullNodeFee, networkFee };
}

function addInputBaseTranction(balanceObject: any, address: string, amount: number, baseTransactions: BaseTransaction[]) {
  let { addressBalance, addressPreBalance } = balanceObject[address];
  const balance = new BigDecimal(`${addressBalance}`);
  const preBalance = new BigDecimal(`${addressPreBalance}`);
  const addressMaxAmount = preBalance.compareTo(balance) < 0 ? preBalance : balance;
  const decimalAmount = new BigDecimal(amount.toString());
  if (addressMaxAmount.compareTo(decimalAmount) < 0)
    throw new Error(
      `Error at create transaction - Trying to send ${decimalAmount}, current balance is ${addressMaxAmount}. Not enough balance in address: ${address}`
    );
  const spendFromAddress = decimalAmount.multiply(new BigDecimal('-1'));
  baseTransactions.push(new BaseTransaction(address, spendFromAddress, BaseTransactionName.INPUT));
}

function addOutputBaseTransactions(
  originalAmount: BigDecimal,
  fullNodeFee: BaseTransactionData,
  networkFee: BaseTransactionData,
  destinationAddress: string,
  baseTransactions: BaseTransaction[],
  feeIncluded: boolean
) {
  const amountRBT = feeIncluded
    ? originalAmount.subtract(new BigDecimal(fullNodeFee.amount)).subtract(new BigDecimal(networkFee.amount))
    : originalAmount;

  const RBT = new BaseTransaction(destinationAddress, amountRBT, BaseTransactionName.RECEIVER, undefined, undefined, originalAmount);
  const fullNodeTransactionFee = BaseTransaction.getBaseTransactionFromFeeData(fullNodeFee);
  const transactionNetworkFee = BaseTransaction.getBaseTransactionFromFeeData(networkFee);

  baseTransactions.push(fullNodeTransactionFee);
  baseTransactions.push(transactionNetworkFee);
  baseTransactions.push(RBT);
}

async function getTransactionTrustScoreSignature<T extends IndexedAddress>(transactionHash: string, keyPair?: KeyPair, wallet?: IndexedWallet<T>) {
  const transactionTrustScoreSignature = new TransactionTrustScoreSignature(transactionHash);
  return keyPair ? transactionTrustScoreSignature.signByKeyPair(keyPair, true) : await transactionTrustScoreSignature.sign(wallet!, true);
}

async function addTrustScoreToTransaction<T extends IndexedAddress>(
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
