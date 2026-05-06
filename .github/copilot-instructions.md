Minimal Polkadot dapp template (React + Vite + TypeScript). Full AI agent guidance is in `CLAUDE.md` at the repo root — read it before proposing changes.

- Host API (`@polkadot-apps/signer` + `@novasamatech/host-api`) is how the embedded dapp obtains accounts and requests signatures from the host (Polkadot Desktop) over a postMessage transport; only works when embedded.
- No browser/extension fallbacks — out-of-scope on purpose.
