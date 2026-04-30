# Polkadot Playground

Minimal React + Vite + TypeScript template wired to Host API for Polkadot wallet login. A starting point for building Polkadot dapps.

A live deployment runs at [**playground.dot.li**](https://playground.dot.li) — open it inside Polkadot Desktop to see the template connect to the Host API, surface your SS58 + EVM (H160) addresses, and sign a message end-to-end.

## Mod it

This repo is meant to be forked, gutted, and turned into your own dapp. The pieces you'll most likely want to swap or extend:

- **Account panel** ([src/App.tsx](src/App.tsx)) — replace the address display + sign demo with whatever your app actually does. The `SignDemo` component is a working reference for calling `signerManager.signRaw(...)` once you have a selected account.
- **App shell** ([src/App.tsx](src/App.tsx), [src/App.css](src/App.css)) — header, layout, and theme are intentionally tiny so you can rip them out. The `#root { max-width: 520px }` cap is just a default; widen or remove it for dashboards / multi-column layouts.
- **Stack additions** — `polkadot-api` for chain RPC, `@polkadot-apps/bulletin` for off-chain storage, `@dotdm/cdm` for smart contracts, `@polkadot-apps/statement-store` for P2P pub/sub. See [CLAUDE.md](CLAUDE.md) for the full stack table.

When you're ready, deploy your fork to your own `<name>.dot` domain (see below) — no servers, no hosting bill.

## Stack

- **React 19** + **Vite** + **TypeScript**
- **`@polkadot-apps/signer`** — Host API login

## Running

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173`. Must be opened inside **Polkadot Desktop** for Host API login to work.

## Structure

```
src/
├── App.tsx       # Header + account selector + your app shell
├── utils.ts      # SignerManager + small helpers
└── main.tsx      # Vite entry
```

## Deploying

A `/deploy <name>` slash command is wired up for Claude Code users — it runs `dot deploy` against `<name>.dot` using the phone signer. Standalone:

```bash
npm run build
dot deploy --no-build --buildDir dist --domain <name>.dot --signer phone --playground
```
