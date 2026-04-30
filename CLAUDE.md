# Polkadot Playground — agent guidance

A minimal Polkadot dapp template: React 19 + Vite + TypeScript, wired to Host API for wallet login. Use this as a starting point for building Polkadot apps.

## Polkadot stack

| Layer | Package |
|-------|---------|
| Wallet / signer | `@polkadot-apps/signer` |
| Host API | `@novasamatech/host-api` (Polkadot Desktop only) |
| Low-level RPC | `polkadot-api` (add when you need it) |

Other packages worth knowing about for richer apps:

- `@polkadot-apps/bulletin` — IPFS-style off-chain storage
- `@dotdm/cdm` — smart contract toolchain (Rust/PVM)
- `@polkadot-apps/statement-store` — real-time P2P pub/sub

## Landmarks

- Frontend entry + account selection: [src/App.tsx](src/App.tsx)
- Signer helpers: [src/utils.ts](src/utils.ts)
- Vite + TS config: [vite.config.ts](vite.config.ts), [tsconfig.json](tsconfig.json)

## Conventions

- **Host API login only works inside Polkadot Desktop.** Don't propose extension/browser fallbacks — they're intentionally out-of-scope.
- Signed extrinsics (Bulletin uploads, contract calls, etc.) require PAS tokens. Faucets:
  - Asset Hub: https://faucet.polkadot.io/
  - Bulletin: https://paritytech.github.io/polkadot-bulletin-chain/authorizations?tab=faucet
- Polkadot Desktop itself isn't installable from this repo — point users at the Polkadot Apps documentation if they don't have it.

## Slash commands

- `/dev` — install deps if needed, then start the dev server in the background.
- `/deploy <name>` — build and deploy to `<name>.dot` via the `dot` CLI (phone signer).
