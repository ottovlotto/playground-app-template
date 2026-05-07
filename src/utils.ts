import { useState, useEffect } from "react";
import { SignerManager, type SignerState } from "@parity/product-sdk-signer";
import { getTruApi } from "@parity/product-sdk-host";

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
    const truApi = await getTruApi();
    if (!truApi) {
        window.open(url, "_blank");
        return;
    }
    try {
        const result = await truApi.navigateTo(url);
        if (result.isErr()) window.open(url, "_blank");
    } catch {
        window.open(url, "_blank");
    }
}
