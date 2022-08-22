import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import TransportWebHid from '@ledgerhq/hw-transport-webhid';
import { HWSDK, SigningData, SigningType as LedgerSigningType } from '@coti-io/ledger-sdk';
import { listen as listenLedgerLog, Log } from '@ledgerhq/logs';
import * as signature from '../signature';
import { SignatureData, SigningType } from '../signature';
import { LedgerError } from '../cotiError';
import Transport, { Descriptor, DescriptorEvent, Observer } from '@ledgerhq/hw-transport';

export { SigningData, BaseTransactionSigningData, TransactionSigningData } from '@coti-io/ledger-sdk';

const NODE_APP = globalThis.process?.release?.name;
const listenTimeout = 3000;
const exchangeTimeout = 60000;

export type LedgerTransportType = 'node' | 'web' | 'webhid';

export type LedgerLog = Log;

const ledgerTransport: {
  node?: typeof Transport;
  web: typeof TransportWebUSB;
  webhid: typeof TransportWebHid;
} = {
  web: TransportWebUSB,
  webhid: TransportWebHid,
};

if (NODE_APP) {
  ledgerTransport.node = require('@ledgerhq/hw-transport-node-hid').default;
}

function checkTransportType(transportType: LedgerTransportType): void {
  if (NODE_APP && transportType !== 'node') throw new Error('Ledger transport type should be node type');
  if (!NODE_APP && transportType === 'node') throw new Error('Ledger transaction type can not be node type');
}

export function listenLog(callback: (ledgerLog: LedgerLog) => void): void {
  listenLedgerLog(callback);
}

export function listen(observer: Observer<DescriptorEvent<Descriptor>>, transportType: LedgerTransportType = 'web'): void {
  checkTransportType(transportType);
  ledgerTransport[transportType]!.listen(observer);
}

export async function connect(transportType: LedgerTransportType = 'web'): Promise<HWSDK> {
  checkTransportType(transportType);
  const transport = await ledgerTransport[transportType]!.create(undefined, listenTimeout);
  transport.setExchangeTimeout(exchangeTimeout);

  return new HWSDK(transport);
}

export async function getPublicKey(index: number, interactive?: boolean, transportType?: LedgerTransportType): Promise<string> {
  try {
    const hw = await connect(transportType);

    const res = await hw.getPublicKey(index, interactive);
    return res.publicKey;
  } catch (error) {
    throw new LedgerError(error.message, { debugMessage: `Error getting public key for index ${index} from ledger wallet`, cause: error });
  }
}

export async function getUserPublicKey(interactive?: boolean, transportType?: LedgerTransportType): Promise<string> {
  try {
    const hw = await connect(transportType);

    const res = await hw.getUserPublicKey(interactive);
    return res.publicKey;
  } catch (error) {
    throw new LedgerError(error.message, { debugMessage: `Error getting user public key from ledger wallet`, cause: error });
  }
}

export async function signMessage(
  index: number,
  messageInBytes: Uint8Array,
  signingType?: SigningType,
  hashed?: boolean,
  transportType?: LedgerTransportType,
  signingData?: SigningData
): Promise<SignatureData> {
  try {
    const hw = await connect(transportType);

    const ledgerSigningType = getLedgerSigningType(signingType);
    const res = await hw.signMessage(index, messageInBytes, ledgerSigningType, hashed, signingData);
    return { r: res.r, s: res.s };
  } catch (error) {
    throw new LedgerError(error.message, { debugMessage: `Error signing message at ledger wallet`, cause: error });
  }
}

export async function signUserMessage(
  messageInBytes: Uint8Array,
  signingType?: SigningType,
  hashed?: boolean,
  transportType?: LedgerTransportType,
  signingData?: SigningData
): Promise<SignatureData> {
  try {
    const hw = await connect(transportType);

    const ledgerSigningType = getLedgerSigningType(signingType);
    const res = await hw.signUserMessage(messageInBytes, ledgerSigningType, hashed, signingData);
    return { r: res.r, s: res.s };
  } catch (error) {
    throw new LedgerError(error.message, { debugMessage: `Error signing user message at ledger wallet`, cause: error });
  }
}

function getLedgerSigningType(signingType?: SigningType): number | undefined {
  if (signingType) {
    const signingTypeKey = signature.signingTypeKeyMap.get(signingType);
    if (signingTypeKey) return LedgerSigningType[signingTypeKey];
  }
}
