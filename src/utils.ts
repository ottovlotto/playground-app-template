import { useState, useEffect } from "react";
import { SignerManager, type SignerState } from "@polkadot-apps/signer";
import { hostApi } from "@novasamatech/product-sdk";

export const signerManager = new SignerManager({ dappName: "playground-template" });

export function useSignerState(): SignerState {
    const [state, setState] = useState<SignerState>(signerManager.getState());
    useEffect(() => {
        const unsubscribe = signerManager.subscribe(setState);
        return unsubscribe;
    }, []);
    return state;
}

export async function openExternalLink(url: string) {
    if (signerManager.getState().activeProvider !== "host") {
        window.open(url, "_blank");
        return;
    }
    const result = await hostApi.navigateTo({ tag: "v1", value: url });
    if (result.isErr()) window.open(url, "_blank");
}
