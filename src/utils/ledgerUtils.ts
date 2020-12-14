import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { HWSDK } from '@coti-io/ledger-sdk';
import { SignatureData } from '../signature';

const defaultTimeout = 60000;

export type LedgerIndexedPublicKey = {
  index: number;
  publicKey: string;
};

export type LedgerTransportType = 'node' | 'web';

const ledgerTransport = {
  node: TransportNodeHid,
  web: TransportWebUSB,
};

export async function connect(transportType: LedgerTransportType = 'web') {
  const transport = await ledgerTransport[transportType].create();
  transport.setExchangeTimeout(defaultTimeout);

  return new HWSDK(transport);
}

export async function getPublicKey(index: number, interactive?: boolean, transportType?: LedgerTransportType) {
  const hw = await connect(transportType);

  const res = await hw.getPublicKey(index, interactive);
  return res.publicKey;
}

export async function getPublicKeys(indexes: number[], interactive?: boolean, transportType?: LedgerTransportType) {
  const hw = await connect(transportType);
  const publicKeys: LedgerIndexedPublicKey[] = [];
  for (const index of indexes) {
    const res = await hw.getPublicKey(index, interactive);
    publicKeys.push({ index, publicKey: res.publicKey });
  }
  return publicKeys;
}

export async function getUserPublicKey(interactive?: boolean, transportType?: LedgerTransportType) {
  const hw = await connect(transportType);

  const res = await hw.getUserPublicKey(interactive);
  return res.publicKey;
}

export async function signMessage(index: number, messageHex: string, transportType?: LedgerTransportType): Promise<SignatureData> {
  const hw = await connect(transportType);
  const res = await hw.signMessage(index, messageHex);

  return { r: res.r, s: res.s };
}

export async function signUserMessage(messageHex: string, transportType?: LedgerTransportType): Promise<SignatureData> {
  const hw = await connect(transportType);
  const res = await hw.signUserMessage(messageHex);

  return { r: res.r, s: res.s };
}
