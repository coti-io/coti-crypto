import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import { HWSDK } from '@coti-io/ledger-sdk';
import { SignatureData } from '../signature';
import Transport from '@ledgerhq/hw-transport';

const defaultTimeout = 60000;

export async function connect(transport?: Transport) {
  transport = transport || (await TransportWebUSB.create());
  transport.setExchangeTimeout(defaultTimeout);

  return new HWSDK(transport);
}

export async function getPublicKey(index: number, interactive?: boolean, transport?: Transport) {
  const hw = await connect(transport);

  const res = await hw.getPublicKey(index, interactive);
  return res.publicKey;
}

export async function getUserPublicKey(interactive?: boolean, transport?: Transport) {
  const hw = await connect(transport);

  const res = await hw.getUserPublicKey(interactive);
  return res.publicKey;
}

export async function signMessage(index: number, messageHex: string, transport?: Transport): Promise<SignatureData> {
  const hw = await connect(transport);
  const res = await hw.signMessage(index, messageHex);

  return { r: res.r, s: res.s };
}

export async function signUserMessage(messageHex: string, transport?: Transport): Promise<SignatureData> {
  const hw = await connect(transport);
  const res = await hw.signUserMessage(messageHex);

  return { r: res.r, s: res.s };
}
