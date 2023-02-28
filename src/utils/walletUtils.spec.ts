import {Wallet} from '../wallet';
import {walletUtils} from './walletUtils';

const config = require('dotenv').config().parsed;

let {
    seed,
    fullNodeUrl,
    trustScoreNodeUrl,
} = config;
test('get user trust score', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const userTrustScore = await walletUtils.getUserTrustScore(indexedWallet);
    expect(userTrustScore.trustScore).toBeGreaterThan(0);
});

test('get fullnode fee', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const fullNodeFees = await walletUtils.getFullNodeFees(indexedWallet, '100');

    expect(Number(fullNodeFees.amount)).toBeGreaterThan(0);
});

test('get network fee', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const fullNodeFees = await walletUtils.getFullNodeFees(indexedWallet, '100');
    const networkFees = await walletUtils.getNetworkFees(indexedWallet, fullNodeFees);

    expect(Number(networkFees.amount)).toBeGreaterThan(0);
});

test('get addresses of wallet', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const addresses = await walletUtils.getAddressesOfWallet(indexedWallet);

    expect(Number(addresses.length)).toBeGreaterThan(0);
});

test('check balances', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const addresses = await walletUtils.getAddressesOfWallet(indexedWallet);
    const addressHashes = addresses.map(address => address.getAddressHex());
    const balances = await walletUtils.checkBalances(addressHashes, indexedWallet);
    expect(Object.keys(balances).length).toEqual(addresses.length);
});
test('send address to node', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const addresses = await walletUtils.getAddressesOfWallet(indexedWallet);
    const newAddress = await indexedWallet.generateAddressByIndex(addresses.length + 1);
    const res = await walletUtils.sendAddressToNode(newAddress, indexedWallet);
    expect(res.status).toBe('Success');
});
test('get transaction history', async () => {
    const indexedWallet = new Wallet({seed, fullnode: fullNodeUrl, trustScoreNode: trustScoreNodeUrl, network: 'testnet'});
    const addresses = await walletUtils.getAddressesOfWallet(indexedWallet);
    const res = await walletUtils.getTransactionsHistory(addresses.map(address => address.getAddressHex()), indexedWallet);
    expect(res.size).toBeGreaterThan(0);
});
