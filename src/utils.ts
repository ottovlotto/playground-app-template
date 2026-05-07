import { useEffect, useState } from "react";
import { getTruApi } from "@parity/product-sdk-host";
import {
    AccountNotFoundError,
    SignerManager,
    SigningFailedError,
    err,
    ok,
    type Result,
    type SignerAccount,
    type SignerError,
    type SignerState,
} from "@parity/product-sdk-signer";

const DEFAULT_PRODUCT_ACCOUNT_DOT_NS = "playground.dot";
const PRODUCT_ACCOUNT_DERIVATION_INDEX = 0;

function isLoopbackHost(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getProductAccountIdentifier(): string {
    const configuredIdentifier = import.meta.env.VITE_PRODUCT_ACCOUNT_ID?.trim();
    if (configuredIdentifier) return configuredIdentifier;

    const { host, hostname } = window.location;
    if (isLoopbackHost(hostname)) return host;
    if (hostname.endsWith(".dot.li")) return hostname.slice(0, -".li".length);
    if (hostname.endsWith(".dot")) return hostname;
    return host || DEFAULT_PRODUCT_ACCOUNT_DOT_NS;
}

function initialState(): SignerState {
    return {
        status: "disconnected",
        accounts: [],
        selectedAccount: null,
        activeProvider: null,
        error: null,
    };
}

class ProductAccountSignerManager {
    private readonly productAccountIdentifier = getProductAccountIdentifier();
    private readonly manager = new SignerManager({
        dappName: this.productAccountIdentifier,
        ss58Prefix: 42,
    });
    private readonly subscribers = new Set<(state: SignerState) => void>();
    private state = initialState();

    constructor() {
        this.manager.subscribe(state => {
            if (state.status === "disconnected") {
                this.setState({
                    status: "disconnected",
                    accounts: [],
                    selectedAccount: null,
                    activeProvider: null,
                    error: state.error,
                });
            } else if (state.status === "connecting") {
                this.setState({
                    status: "connecting",
                    activeProvider: state.activeProvider,
                    error: state.error,
                });
            }
        });
    }

    getState(): SignerState {
        return this.state;
    }

    subscribe(callback: (state: SignerState) => void): () => void {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    async connect(): Promise<Result<SignerAccount[], SignerError>> {
        this.setState({
            status: "connecting",
            accounts: [],
            selectedAccount: null,
            activeProvider: "host",
            error: null,
        });

        const connection = await this.manager.connect("host");
        if (!connection.ok) {
            this.setState({
                status: "disconnected",
                accounts: [],
                selectedAccount: null,
                activeProvider: null,
                error: connection.error,
            });
            return connection;
        }
        const ownerName = connection.value[0]?.name ?? null;

        const productAccount = await this.manager.getProductAccount(
            this.productAccountIdentifier,
            PRODUCT_ACCOUNT_DERIVATION_INDEX,
        );
        if (!productAccount.ok) {
            this.manager.disconnect();
            this.setState({
                status: "disconnected",
                accounts: [],
                selectedAccount: null,
                activeProvider: null,
                error: productAccount.error,
            });
            return err(productAccount.error);
        }

        const selectedAccount = {
            ...productAccount.value,
            name: productAccount.value.name ?? ownerName,
        };
        const accounts = [selectedAccount];
        this.setState({
            status: "connected",
            accounts,
            selectedAccount,
            activeProvider: "host",
            error: null,
        });
        return ok(accounts);
    }

    selectAccount(address: string): Result<SignerAccount, SignerError> {
        const account = this.state.accounts.find(candidate => candidate.address === address);
        if (!account) return err(new AccountNotFoundError(address));
        this.setState({ selectedAccount: account });
        return ok(account);
    }

    getSigner(): ReturnType<SignerAccount["getSigner"]> | null {
        return this.state.selectedAccount?.getSigner() ?? null;
    }

    async signRaw(data: Uint8Array): Promise<Result<Uint8Array, SignerError>> {
        const signer = this.getSigner();
        if (!signer) return err(new SigningFailedError(null, "No product account selected"));

        try {
            return ok(await signer.signBytes(data));
        } catch (cause) {
            return err(new SigningFailedError(cause));
        }
    }

    disconnect(): void {
        this.manager.disconnect();
        this.setState(initialState());
    }

    private setState(patch: Partial<SignerState>) {
        this.state = { ...this.state, ...patch };
        for (const subscriber of this.subscribers) {
            subscriber(this.state);
        }
    }
}

export type { SignerAccount, SignerState };

export const signerManager = new ProductAccountSignerManager();

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
