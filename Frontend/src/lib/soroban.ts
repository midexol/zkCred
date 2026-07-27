/**
 * zkCred — Soroban Smart Contract Interop
 * Invokes `verify_proof()` on the deployed Stellar Soroban verifier contract using @stellar/stellar-sdk.
 */

import {
  Contract,
  rpc,
  scValToNative,
  nativeToScVal,
  TransactionBuilder,
  Account,
} from "@stellar/stellar-sdk";
import { VERIFIER_CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE } from "../config";
import type { ProofPayload } from "./prover";
import { signTransaction } from "./freighter";

export interface VerifyResult {
  success: boolean;
  isValid: boolean;
  txHash?: string;
  error?: string;
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().replace(/^0x/, "");
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Invoke `verify_proof()` on the Soroban verifier contract.
 */
export async function verifyProofOnChain(
  proofPayload: ProofPayload,
  submitterPublicKey?: string
): Promise<VerifyResult> {
  const server = new rpc.Server(RPC_URL);

  try {
    const contract = new Contract(VERIFIER_CONTRACT_ID);

    // Convert proof fields to BytesN ScVals
    const proofScVal = nativeToScVal({
      a: hexToBytes(proofPayload.proof.a),
      b: hexToBytes(proofPayload.proof.b),
      c: hexToBytes(proofPayload.proof.c),
    });

    const publicInputsScVal = nativeToScVal({
      threshold: hexToBytes(proofPayload.public_inputs.threshold),
      asset_id: hexToBytes(proofPayload.public_inputs.asset_id),
      nonce: hexToBytes(proofPayload.public_inputs.nonce),
    });

    // 1. Build contract call operation
    const callOperation = contract.call(
      "verify_proof",
      proofScVal,
      publicInputsScVal
    );

    // If submitterPublicKey is available, build & submit a real Soroban transaction
    if (submitterPublicKey) {
      const account = await server.getAccount(submitterPublicKey);
      const tx = new TransactionBuilder(account, {
        fee: "10000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(callOperation)
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);

      if (rpc.Api.isSimulationSuccess(sim)) {
        const preparedTx = rpc.assembleTransaction(tx, sim).build();
        const signedXdr = await signTransaction(preparedTx.toXDR());
        const sendRes = await server.sendTransaction(
          TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
        );

        if (sendRes.status === "PENDING" || (sendRes.status as string) === "SUCCESS") {
          let statusRes = await server.getTransaction(sendRes.hash);
          let attempts = 0;
          while (statusRes.status === rpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 10) {
            await new Promise((r) => setTimeout(r, 1000));
            statusRes = await server.getTransaction(sendRes.hash);
            attempts++;
          }

          const returnValue = (statusRes as any).returnValue
            ? scValToNative((statusRes as any).returnValue)
            : true;

          return {
            success: true,
            isValid: Boolean(returnValue),
            txHash: sendRes.hash,
          };
        }
      }
    }

    // Fallback: Read-only simulate transaction call directly
    const dummyAddress = submitterPublicKey || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const dummyAccount = new Account(dummyAddress, "0");
    const simTx = new TransactionBuilder(dummyAccount, {
      fee: "10000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(callOperation)
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(simTx);

    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result?.retval) {
      const isProofValid = scValToNative(simResult.result.retval);
      return {
        success: true,
        isValid: Boolean(isProofValid),
        txHash: `sim_${Date.now().toString(16)}`,
      };
    } else {
      return {
        success: true,
        isValid: false,
        txHash: `sim_${Date.now().toString(16)}`,
      };
    }
  } catch (err: any) {
    console.error("Soroban verify_proof failed:", err);
    return {
      success: false,
      isValid: false,
      error: err?.message || String(err),
    };
  }
}
