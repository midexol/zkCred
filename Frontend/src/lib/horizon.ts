/**
 * zkCred — Horizon Balance Reader
 * Fetches token balances for a given Stellar public key from Horizon Testnet.
 */

import { HORIZON_URL } from "../config";

export interface AccountBalances {
  USDC: number;
  EURC: number;
  XLM: number;
}

export async function fetchAccountBalances(publicKey: string): Promise<AccountBalances> {
  const result: AccountBalances = {
    USDC: 0,
    EURC: 0,
    XLM: 0,
  };

  if (!publicKey) return result;

  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
    if (!res.ok) {
      if (res.status === 404) {
        // Unfunded or newly created testnet account
        return result;
      }
      throw new Error(`Horizon error: ${res.statusText}`);
    }

    const data = await res.json();
    const balances = data.balances || [];

    for (const b of balances) {
      if (b.asset_type === "native") {
        result.XLM = parseFloat(b.balance) || 0;
      } else if (b.asset_code === "USDC") {
        result.USDC = parseFloat(b.balance) || 0;
      } else if (b.asset_code === "EURC") {
        result.EURC = parseFloat(b.balance) || 0;
      }
    }
  } catch (e) {
    console.warn("Failed to fetch Horizon balance, defaulting to 0:", e);
  }

  return result;
}
