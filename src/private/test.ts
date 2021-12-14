import axios from 'axios';
import { BaseTransaction, cryptoUtils, Transaction, TransactionData, TransactionTrustScoreSignature, TransactionType, transactionUtils, utils, walletUtils } from '..';
import { FullNodeFeeSignature } from '../signature';
import { hashKeccak256 } from '../utils/cryptoUtils';
import { nodeUtils } from '../utils/nodeUtils';
import { tokenUtils } from '../utils/tokenUtils';
import { createTransaction, getFees } from '../utils/transactionUtils';
import { BigDecimal, hexToArray, hexToBytes } from '../utils/utils';
import { Wallet } from '../wallet';

const seed = '9222222222222221596e60bed8d63f0d37c48232e95c63f1e5e00d08adaaba68'
const privateKey = "bdffbed155a620721a64754872fe457f3aba41bc0096676bf78feab8ebc8b7a9"
const userHash = "7b352171760d1e025c938152f191e9f1da78f04ca6de589e9d71c1d99bdbccd1c7557eab9a1bc66ca0c4d5947eeff68988dd26523356ca43e0ddcee31ee3f68f"

const wallet_address = "e73d96a99e1f7506e60090d3b5f9e7422e7bd1b447960b3ce99b16a21d7e98a6cd6fc81b6cc8101b3e1aab8192fda3e990e5336f0558dddcd169188b9ff8aa915d8ca34d"
const wallet_address_for_TS = wallet_address
const wallet_address_IBT = wallet_address
const wallet_address_receive_token = wallet_address

const currencyName = "yairpxx"
const currencySymbol = "YAIRPXX"
const currencyType = "REGULAR_CMD_TOKEN"
const description = "notathing"
const totalSupply = 10
const mintingAmount = 10
const scale = 5
const currencyRateSourceType = "ADDRESS"
const rateSource = "something";
const protectionModel = "something";
const NATIVE_currencyHash = 'e72d2137d5cfcc672ab743bddbdedb4e059ca9d3db3219f4eb623b01';
const financeNode = 'https://coti-financial-node.coti.io';
const financeNodeUrl = 'https://coti-financial-node.coti.io';
const fullNodeUrl = 'https://coti-full-node.coti.io';
const trustScoreUrl = 'https://coti-trust-node.coti.io';
(async () => {
    let userTokenCurrencies = await nodeUtils.getUserTokenCurrencies(userHash, privateKey, seed);
    const indexedWallet = new Wallet({ seed, fullnode: 'https://coti-full-node.coti.io',trustScoreNode: 'https://coti-trust-node.coti.io' });
    userTokenCurrencies.filter( (item?: any) => {
        if(item.confirmed && item.mintableAmount > item.mintedAmount){
            console.log(JSON.stringify(item));
        }
})
    const generateTokenTransactionDescription = 'generate token';
    const mintTransactionDescription = 'mint token: MTWDE';
    // const tokenGenerationTransaction = await createTransaction(
    // {
    //     wallet: indexedWallet,
    //     feeAddress: wallet_address,
    //     inputMap:newInputMap,
    //     description: generateTokenTransactionDescription,
    //     destinationAddress: wallet_address,
    //     fullnode: fullNodeUrl,
    //     trustScoreNode: trustScoreUrl,
    //     feeIncluded: false,
    //     includeNetworkFee: false,
    //     transactionType: TransactionType.TOKENGENERATION,
    //     tokenGenerationParams
    // });
    // //currencyHash =  '909f852149d1be977fa9981307a5c61d7866406e9dc107d4bbd28902';  
    const token_generation_fee_base_transaction = await tokenUtils.currenciesTokenGenerate(userHash, currencyName, currencySymbol, currencyType, description,
                                                                                           totalSupply, scale, currencyRateSourceType, rateSource, protectionModel,
                                                                                           seed, financeNode);
    // //currencyHash = token_generation_fee_base_transaction.currencyHash;
    // console.log('finished first part');
    
    //Fees part (FFBT + TSD)
    const amount = Number(token_generation_fee_base_transaction.amount);
    const amountBD = new BigDecimal(token_generation_fee_base_transaction.amount);
    const full_node_fee = await getFFBT(amount, "e72d2137d5cfcc672ab743bddbdedb4e059ca9d3db3219f4eb623b01");
    
    //const { fullNodeFee } = await getFees(amountBD, userHash!, undefined, indexedWallet, false, undefined, 'https://coti-full-node.coti.io', 'https://coti-trust-node.coti.io', false, 'e72d2137d5cfcc672ab743bddbdedb4e059ca9d3db3219f4eb623b01');
    const generateTokenTrustScoreData = await getTrustScore(userHash, token_generation_fee_base_transaction, full_node_fee, "tokenGenerationFee", wallet_address_for_TS, seed);
    
    // // // Send transaction
    const tokenGenerateTransactionData = await nodeUtils.transactionTokenGeneration(token_generation_fee_base_transaction, full_node_fee, generateTokenTrustScoreData,
                                                                                       wallet_address_IBT, seed, userHash, TransactionType.TOKENGENERATION, 'testnet',
                                                                                       `https://coti-full-node.coti.io`, generateTokenTransactionDescription);
                                                                                       
    let currencyHash = '';
    userTokenCurrencies = await nodeUtils.getUserTokenCurrencies(userHash, privateKey, seed);
    userTokenCurrencies.filter( (item?: any) => {
         if(item.currencyName == currencyName) {
            currencyHash = item.currencyHash; 
         }
         if(item.confirmed && item.mintableAmount > item.mintedAmount){
             console.log(JSON.stringify(item));
         }
    });
    
    // currencyHash = '85864291194fd2eac2de135a3087382de83d5c3206ac85c2a7c20546';
    // // MINT
    // const token_mint_fee_quote = await tokenUtils.mintQuote(currencyHash, userHash, seed, mintingAmount);
    // const mintingAmountResult = token_mint_fee_quote.mintingAmount;
    // const feeAmount = token_mint_fee_quote.mintingFee

    // const mintFees = await tokenUtils.getTokenMintFee(currencyHash, mintingAmountResult, feeAmount, wallet_address_receive_token, userHash, seed);
    // const mintFullNodeFee = await getFFBT(Number(mintFees.amount), "e72d2137d5cfcc672ab743bddbdedb4e059ca9d3db3219f4eb623b01");
    // const mintTrustScoreData = await getTrustScore(userHash, mintFees, mintFullNodeFee, 'tokenServiceFee', wallet_address_for_TS, seed);

    // const mintingTransactionData = await nodeUtils.transactionTokenGeneration(mintFees, mintFullNodeFee, mintTrustScoreData, wallet_address_IBT, seed, userHash,
    //                                                                           TransactionType.TOKENMINTING, 'testnet', `https://coti-full-node.coti.io`, mintTransactionDescription);


    //Transfer token to other address
    
    const address2 = await indexedWallet.generateAddressByIndex(1);
    //currencyHash = '3bc87727dcaabcc7ae53e90e3642851b07694b7e9183816f0fc70b72'
    await transfer(address2.getAddressHex(), currencyHash);

})()

async function getFFBT( amount : number, originalCurrencyHash: string){
    const tokenGeneration = new FullNodeFeeSignature(amount, originalCurrencyHash);
    const indexedWallet = new Wallet({ seed });
    const signatureData = await tokenGeneration.sign(indexedWallet, false);
    const nodeFeesTransaction = await nodeUtils.getFullNodeFees(amount, userHash, signatureData, 'testnet', false, 'https://coti-full-node.coti.io', originalCurrencyHash);
    return nodeFeesTransaction;
}


async function getTrustScore(userHash: string, token_generation_fee_base_transaction: any, full_node_fee: any, baseType: string, wallet_address_for_TS: string, seed: string){
    
    const instant_time = new Date().getTime() * 1000;
    const IBT_addressHash = wallet_address_for_TS;
    const fullAmount = token_generation_fee_base_transaction.amount + parseFloat(full_node_fee.amount);
    const IBT_amount = `${fullAmount * -1}`;

    const addressBytes = utils.hexToBytes(IBT_addressHash);
    const instantTimeBytes = utils.numberToByteArray(instant_time, 8);
    const currencyHashBytes = full_node_fee.currencyHash? utils.hexToBytes(full_node_fee.currencyHash): new Uint8Array();
    const message = `${IBT_amount}`;
    const arraysToMerge = [ addressBytes, instantTimeBytes, utils.getBytesFromString(message), currencyHashBytes];

    const IBT_Hash = cryptoUtils.hashKeccak256(utils.concatByteArrays(arraysToMerge));
    const msgT = IBT_Hash + full_node_fee.hash + token_generation_fee_base_transaction.hash;
    const hT = cryptoUtils.hashKeccak256(utils.hexToBytes(msgT));
    const tokenGeneration = new TransactionTrustScoreSignature(msgT);
    const indexedWallet = new Wallet({ seed });
    const signatureData = await tokenGeneration.sign(indexedWallet, false);
    
    const payload = {
        userHash,
        transactionHash: hT,
        userSignature: signatureData
    }
    const headers = {
        'Content-Type': "application/json"
    }

    try {
        const { data } = await axios.post(`https://coti-trust-node.coti.io/transactiontrustscore`,payload, { headers });
        return data.transactionTrustScoreData;
      } catch (error) {
        throw error;
      }
}


// // GENERATE TOKEN
// generateUtils.tokenGenerate(user_hash, private_key, currency_name,currency_symbol, currency_type, description,total_supply, scale, currencyRateSourceType, rateSource, protectionModel);

// trust_score_data = proxy_transaction_trustscore(user_hash)

// // MINT TOKEN
// token_mint_fee_quote = proxy_currencies_token_mint_quote(currency_hash, user_hash, private_key, mintingAmount)
// minting_amount = json.loads(token_mint_fee_quote)['mintingFeeQuote']['mintingAmount']
// fee_amount = json.loads(token_mint_fee_quote)['mintingFeeQuote']['mintingFee']
// token_mint_fee = proxy_currencies_token_mint_fee(currency_hash, minting_amount, fee_amount,
//                                                  wallet_address_receive_token, user_hash, private_key)
// full_node_fee = proxy_full_node_fee(token_mint_fee, 'tokenServiceFee', user_hash, private_key)
// trust_score_data = proxy_transaction_trustscore(seed, token_mint_fee, full_node_fee, 'tokenServiceFee',
//                                                 wallet_address_for_TS, user_hash)
// proxy_transaction_TokenMinting(token_mint_fee, full_node_fee, trust_score_data, wallet_address_IBT, user_hash)

// proxy_currencies_token_mint_history(user_hash, private_key)

async function transfer(destinationAddress: string, currencyHash?: string ){
    const indexedWallet = new Wallet({ seed, fullnode: 'https://coti-full-node.coti.io',trustScoreNode: 'https://coti-trust-node.coti.io' });
    const address = await indexedWallet.generateAddressByIndex(0);
    const address2 = await indexedWallet.generateAddressByIndex(1);
    await indexedWallet.loadAddresses([address, address2]);
    const newInputMap = new Map();
    newInputMap.set(address.getAddressHex(), 1);
    newInputMap.set(address2.getAddressHex(), 1);
    
    const addressesBalanceObj = await nodeUtils.checkBalances([address.getAddressHex()], undefined, 'https://coti-trust-node.coti.io' );
    for(let [key,value] of Object.entries(addressesBalanceObj)){
     // @ts-ignore
      indexedWallet.setAddressWithBalance(address, value.addressBalance, value.addressPreBalance)
    }
    const newTransaction = await createTransaction({
        wallet: indexedWallet,
        inputMap: newInputMap,
        description: 'transfer',
        feeAddress: address.getAddressHex(),
        destinationAddress: destinationAddress,
        feeIncluded: true,
      });
    await newTransaction.signTransaction(indexedWallet)
    // @ts-ignore
    await nodeUtils.sendTransaction(newTransaction, null,'https://coti-full-node.coti.io');
}