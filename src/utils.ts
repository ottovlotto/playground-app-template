import { useEffect, useState } from "react";
import { enumValue, getTruApi } from "@parity/product-sdk-host";
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
const RESOURCE_ALLOCATION_REQUESTS = [
    { tag: "StatementStoreAllowance", value: undefined },
    { tag: "BulletInAllowance", value: undefined },
    { tag: "SmartContractAllowance", value: PRODUCT_ACCOUNT_DERIVATION_INDEX },
    { tag: "AutoSigning", value: undefined },
] as const;

type ResourceAllocationRequest = (typeof RESOURCE_ALLOCATION_REQUESTS)[number];
export type ResourceAllocationKind = ResourceAllocationRequest["tag"];
export type ResourceAllocationOutcome = "Allocated" | "Rejected" | "NotAvailable";

export interface ResourceAllocationEntry {
    resource: ResourceAllocationKind;
    outcome: ResourceAllocationOutcome | null;
}

export interface ResourceAllocationState {
    status: "idle" | "requesting" | "complete" | "unavailable" | "error";
    entries: ResourceAllocationEntry[];
    error: string | null;
}

interface VersionedResponse<T> {
    tag: string;
    value: T;
}

interface ResultAsync<T, E> {
    match<A, B = A>(ok: (value: T) => A, err: (error: E) => B): Promise<A | B>;
}

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

function initialResourceAllocationState(): ResourceAllocationState {
    return {
        status: "idle",
        entries: RESOURCE_ALLOCATION_REQUESTS.map(request => ({
            resource: request.tag,
            outcome: null,
        })),
        error: null,
    };
}

function formatHostError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === "object") {
        const record = error as Record<string, unknown>;
        if (typeof record.reason === "string") return record.reason;
        if (typeof record.message === "string") return record.message;
        if (typeof record.tag === "string") {
            const value = record.value;
            if (value && typeof value === "object" && typeof (value as { reason?: unknown }).reason === "string") {
                return `${record.tag}: ${(value as { reason: string }).reason}`;
            }
            return record.tag;
        }
    }
    return String(error);
}

class ProductAccountSignerManager {
    private readonly productAccountIdentifier = getProductAccountIdentifier();
    private readonly manager = new SignerManager({
        dappName: this.productAccountIdentifier,
        ss58Prefix: 42,
    });
    private readonly subscribers = new Set<(state: SignerState) => void>();
    private readonly resourceSubscribers = new Set<(state: ResourceAllocationState) => void>();
    private state = initialState();
    private resourceAllocationState = initialResourceAllocationState();
    private connectPromise: Promise<Result<SignerAccount[], SignerError>> | null = null;

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

    getResourceAllocationState(): ResourceAllocationState {
        return this.resourceAllocationState;
    }

    subscribe(callback: (state: SignerState) => void): () => void {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    subscribeResourceAllocation(callback: (state: ResourceAllocationState) => void): () => void {
        this.resourceSubscribers.add(callback);
        return () => {
            this.resourceSubscribers.delete(callback);
        };
    }

    async connect(): Promise<Result<SignerAccount[], SignerError>> {
        if (this.state.status === "connected") return ok([...this.state.accounts]);
        if (this.connectPromise) return this.connectPromise;

        this.connectPromise = this.connectInner().finally(() => {
            this.connectPromise = null;
        });
        return this.connectPromise;
    }

    private async connectInner(): Promise<Result<SignerAccount[], SignerError>> {
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
        void this.requestResourceAllocation();
        return ok(accounts);
    }

    async requestResourceAllocation(): Promise<ResourceAllocationState> {
        const requestedEntries = initialResourceAllocationState().entries;
        this.setResourceAllocationState({
            status: "requesting",
            entries: requestedEntries,
            error: null,
        });

        try {
            const truApi = await getTruApi();
            if (!truApi?.requestResourceAllocation) {
                const nextState: ResourceAllocationState = {
                    status: "unavailable",
                    entries: requestedEntries,
                    error: "Host does not expose requestResourceAllocation",
                };
                this.setResourceAllocationState(nextState);
                return nextState;
            }

            const result = (await truApi.requestResourceAllocation(
                enumValue("v1", [...RESOURCE_ALLOCATION_REQUESTS]),
            )) as ResultAsync<
                VersionedResponse<Array<{ tag: ResourceAllocationOutcome; value: undefined }>>,
                VersionedResponse<unknown>
            >;

            const outcomes = await result.match(
                payload => {
                    if (payload.tag !== "v1") {
                        throw new Error(`Unknown resource allocation response version: ${payload.tag}`);
                    }
                    return payload.value;
                },
                error => {
                    throw new Error(formatHostError(error.value));
                },
            );

            const nextState: ResourceAllocationState = {
                status: "complete",
                entries: RESOURCE_ALLOCATION_REQUESTS.map((request, index) => ({
                    resource: request.tag,
                    outcome: outcomes[index]?.tag ?? "NotAvailable",
                })),
                error: null,
            };
            this.setResourceAllocationState(nextState);
            return nextState;
        } catch (error) {
            const nextState: ResourceAllocationState = {
                status: "error",
                entries: requestedEntries,
                error: formatHostError(error),
            };
            this.setResourceAllocationState(nextState);
            return nextState;
        }
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
        this.setResourceAllocationState(initialResourceAllocationState());
    }

    private setState(patch: Partial<SignerState>) {
        this.state = { ...this.state, ...patch };
        for (const subscriber of this.subscribers) {
            subscriber(this.state);
        }
    }

    private setResourceAllocationState(state: ResourceAllocationState) {
        this.resourceAllocationState = state;
        for (const subscriber of this.resourceSubscribers) {
            subscriber(this.resourceAllocationState);
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

export function useResourceAllocationState(): ResourceAllocationState {
    const [state, setState] = useState<ResourceAllocationState>(
        signerManager.getResourceAllocationState(),
    );
    useEffect(() => {
        const unsubscribe = signerManager.subscribeResourceAllocation(setState);
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
