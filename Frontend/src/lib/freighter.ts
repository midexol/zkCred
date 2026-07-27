/**
 * zkCred — Freighter Wallet Integration using official @stellar/freighter-api
 */

import freighter from "@stellar/freighter-api";
const { isConnected, getAddress, signTransaction: freighterSignTx } = freighter;

import { NETWORK_PASSPHRASE } from "../config";

export interface WalletInfo {
  publicKey: string;
  displayAddress: string;
  network: string;
}

export type WalletError =
  | { code: "NOT_INSTALLED" }
  | { code: "USER_REJECTED" }
  | { code: "UNKNOWN"; message: string };

/**
 * Connect to Freighter and return wallet info.
 */
export async function connectWallet(): Promise<WalletInfo> {
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw { code: "NOT_INSTALLED" } as WalletError;
  }

  try {
    const keyResult = await getAddress();
    const publicKey = typeof keyResult === "string" ? keyResult : (keyResult as any)?.address;
    if (!publicKey) {
      throw { code: "USER_REJECTED" } as WalletError;
    }

    return {
      publicKey,
      displayAddress: shortenAddress(publicKey),
      network: "testnet",
    };
  } catch (err: any) {
    if (err?.code === "USER_REJECTED" || err?.message?.includes("User rejected")) {
      throw { code: "USER_REJECTED" } as WalletError;
    }
    throw { code: "UNKNOWN", message: err?.message || String(err) } as WalletError;
  }
}

/**
 * Get the current connected wallet address without prompting if possible.
 */
export async function getConnectedAddress(): Promise<string | null> {
  try {
    const installed = await isFreighterInstalled();
    if (!installed) return null;
    const keyResult = await getAddress();
    const key = typeof keyResult === "string" ? keyResult : (keyResult as any)?.address;
    return key || null;
  } catch {
    return null;
  }
}

/**
 * Sign a Stellar transaction XDR using Freighter.
 */
export async function signTransaction(
  txXdr: string,
  networkPassphrase: string = NETWORK_PASSPHRASE
): Promise<string> {
  const res = await freighterSignTx(txXdr, {
    networkPassphrase,
  });
  if (typeof res === "string") return res;
  if ((res as any)?.signedTxXdr) return (res as any).signedTxXdr;
  throw new Error("Failed to sign transaction with Freighter");
}

export function shortenAddress(address: string): string {
  if (!address || address.length <= 12) return address || "";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const res = await isConnected();
    if (typeof res === "boolean") return res;
    return !!(res as any)?.isConnected;
  } catch {
    return false;
  }
}
