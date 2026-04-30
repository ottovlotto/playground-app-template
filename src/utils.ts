import { useState, useEffect } from "react";
import { SignerManager, type SignerState } from "@polkadot-apps/signer";

// ---------------------------------------------------------------------------
// Signer Manager (Host API)
// ---------------------------------------------------------------------------

export const signerManager = new SignerManager({ dappName: "playground-template" });

export function useSignerState(): SignerState {
    const [state, setState] = useState<SignerState>(signerManager.getState());
    useEffect(() => {
        const unsubscribe = signerManager.subscribe(setState);
        return unsubscribe;
    }, []);
    return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const short = (addr: string) => addr.slice(0, 6) + "..." + addr.slice(-4);

export const toHex = (bytes: Uint8Array) =>
    "0x" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
