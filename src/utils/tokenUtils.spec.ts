import {Wallet} from '../wallet';
import {tokenUtils} from './tokenUtils';

const config = require('dotenv').config().parsed;

let {
    seed,
    currencyName,
    currencyHash,
    currencyType,
    currencySymbol,
    fullNodeUrl,
    trustScoreNodeUrl,
    description,
    scale,
    totalSupply,
    currencyRateSourceType,
    rateSource,
    protectionModel,
    userHash
} = config;
test('get token mint fee request', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const res = await tokenUtils.getTokenMintFeeRequest(
        currencyHash,
        100,
        2,
        'a6874cb533b253cb78b012ed86993c5ba455cc16cdd4af55bfbc9677a8ed4b582d1d0e846916f43000290f5fbe5b882e36d4a865934bbad4b524808f29b87b2aaadc6936',
        userHash,
        indexedWallet,
    );
    expect(res).not.toBe(null);
});
test('get token mint quote request', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const res = await tokenUtils.getMintQuoteFeeRequest(
        currencyHash,
        userHash,
        indexedWallet,
        '100',
    );
    expect(res).not.toBe(null);
});

test('get token generation fee request', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const mqft = await tokenUtils.getTokenGenerationFeeRequest({
        userHash,
        currencyName,
        currencySymbol,
        currencyType,
        description,
        totalSupply,
        scale,
        currencyRateSourceType,
        rateSource,
        protectionModel,
        indexedWallet,
    });
    expect(mqft).not.toBe(null);
});
