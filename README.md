# mesh-lunch-roulette

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--lunch--roulette-4DCB8D?style=flat-square)](https://baditaflorin.github.io/mesh-lunch-roulette/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-lunch-roulette?style=flat-square&color=4DCB8D)](https://github.com/baditaflorin/mesh-lunch-roulette/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-0f1418?style=flat-square)](docs/adr/0001-deployment-mode.md)

> History-aware weekly coffee-chat pairing for teams. Strongly favors people who've never met, so repeats stay rare until the team has mixed.

**Live:** https://baditaflorin.github.io/mesh-lunch-roulette/

Open the link on any device. Add your team's names to the shared roster.
Press **"Pair this week"** — the algorithm produces a pairing that
prioritizes people who have never met, falls back to longest-time-since for
the rest, and handles odd team sizes with a wildcard **triple**. Tap
**Re-pair this week** if you want a different arrangement with the same
"freshness first" rule.

The same room can be opened on every team member's device. Yjs replicates
the roster and history peer-to-peer, so any peer's view is authoritative
and the pairing is deterministic given the same inputs.

## How it works

1. The team's data lives in a Yjs document:
   - `Y.Array<string>("roster")` — names.
   - `Y.Map<weekISO, Pairing>("history")` — past pairings.
   - `Y.Map<string, {currentWeek, seedBump}>("state")`.
2. Pressing **Pair this week** runs a **weighted greedy** matching:
   - Edge weights = `weeksSinceLastPaired(a, b)`, `Infinity` if never paired,
     ×0.0001 penalty if paired within the last K weeks.
   - Sort `(weight desc, stableTiebreak asc)`; greedy pick.
   - Odd N → remove the most-constrained person, attach as a **wildcard
     triple** to a seed-chosen pair.
3. Pairings are keyed by **ISO week strings** (e.g. `2026-W19`). Stable across
   timezones up to ~12h boundary.

Algorithm details: [ADR 0002](docs/adr/0002-weighted-greedy-matching.md).
Period key details: [ADR 0003](docs/adr/0003-iso-week-period-key.md).

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). The room ID is the team key — share
it out-of-band. The roster and history are visible to every peer in the
room.

## Architecture

- **Mode A** — pure GitHub Pages.
- **WebRTC** — Yjs + y-webrtc with self-hosted signaling and TURN.
- **No clock sync needed** — pairings are deterministic given the Yjs state.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-lunch-roulette.git
cd mesh-lunch-roulette
npm install
npm run dev
```

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                      |
| ---------------------------------------------------------------------- | -------------------------------------- | ------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds           |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                |

## Settings

- **Room ID** — the team key.
- **Your name** — used to highlight your assigned pair.
- **Lookback K** — 1–12 weeks; how long before repeats are unpenalized.
- **Clear pairing history** — wipes `Y.Map<history>` for the team.

## ADRs

- [0001 — Deployment mode](docs/adr/0001-deployment-mode.md)
- [0002 — Weighted greedy bipartite matching](docs/adr/0002-weighted-greedy-matching.md)
- [0003 — ISO week as the period key](docs/adr/0003-iso-week-period-key.md)
- [0010 — GitHub Pages publishing](docs/adr/0010-pages-publishing.md)

## License

[MIT](LICENSE) © 2026 Florin Badita
