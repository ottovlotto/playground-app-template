---
description: Install deps if needed, then start the dev server in the background.
---

If `node_modules/` is missing, run `npm install` first (takes ~30s) and show the user the tail of the output. Then start `npm run dev` in the background and tell the user the URL it's serving (typically http://localhost:5173).

Remind them:
- The app must be opened inside **Polkadot Desktop** for Host API login to work.
- The dev server runs in this Claude Code session — it stops when the session ends. For a persistent server, tell them to run `npm run dev` in their own terminal.
