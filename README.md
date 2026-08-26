# Lunch Table

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--lunch--roulette-E0B44C?style=flat-square)](https://baditaflorin.github.io/mesh-lunch-roulette/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-lunch-roulette?style=flat-square&color=E0B44C)](https://github.com/baditaflorin/mesh-lunch-roulette/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-0f1418?style=flat-square)](docs/adr/0001-deployment-mode.md)

> A calm, shared way for a team to make this week's lunch table without
> repeating the same conversations.

**Live:** https://baditaflorin.github.io/mesh-lunch-roulette/

Open the link on any device. The first view is the real shared roster: add the
people in the room and press **Choose this week's table**. The algorithm
prioritizes people who have never met, falls back to longest-time-since for
the rest, and handles odd team sizes with a wildcard **triple**. **Choose
another table** gives the same week a new deterministic seed when the group
wants to reconsider.

The same room can be opened on every team member's device. The live roster,
decision, and result are replicated peer-to-peer with Yjs, so any peer's view
is authoritative and the pairing is deterministic given the same inputs.

## The experience

- **One decisive first view.** The shared roster and the weekly choice are
  visible before any setup detour.
- **Made for the room, not a game show.** The visual language is a restrained,
  editorial table card rather than a spinner or celebration screen.
- **Useful context, quietly present.** Presence, room state, invite, settings,
  your local name, and pairing history stay available without taking over the
  decision.

## How it works

1. The team's data lives in a Yjs document:
   - `Y.Array<string>("roster")` — names.
   - `Y.Map<weekISO, Pairing>("history")` — past pairings.
   - `Y.Map<string, {currentWeek, seedBump}>("state")`.
2. Pressing **Choose this week's table** runs a **weighted greedy** matching:
   - Edge weights = `weeksSinceLastPaired(a, b)`, `Infinity` if never paired,
     ×0.0001 penalty if paired within the last K weeks.
   - Sort `(weight desc, stableTiebreak asc)`; greedy pick.
   - Odd N → remove the most-constrained person, attach as a **wildcard
     triple** to a seed-chosen pair.
3. Pairings are keyed by **ISO week strings** (for example `2026-W19`) and
   remain stable across timezones up to the ~12-hour boundary.

Algorithm details: [ADR 0002](docs/adr/0002-weighted-greedy-matching.md).
Period key details: [ADR 0003](docs/adr/0003-iso-week-period-key.md).

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). The room ID is the team key — share
it out-of-band. The roster and history are visible to every peer in the room.

## Architecture

- **Mode A** — pure GitHub Pages.
- **WebRTC** — Yjs + y-webrtc with self-hosted signaling and TURN.
- **No clock sync needed** — pairings are deterministic given the Yjs state.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-lunch-roulette.git
cd mesh-lunch-roulette
npm ci
npm run dev
```

## Verify the experience

```bash
npm run fmt:check
npm run typecheck
npm run test:unit
npm run smoke
npm run test:e2e
```

The browser suite includes a true two-peer Yjs decision assertion, an
accessibility probe, and viewport contracts for a 390 × 844 phone and a
1141 × 602 desktop window. For the opt-in short leak check:

```bash
MESH_RUN_LEAK_TEST=1 MESH_LEAK_DURATION_MS=5000 npm run test:leak
```

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                      |
| ---------------------------------------------------------------------- | -------------------------------------- | ------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN credentials     |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                |

## Settings

- **Room ID** — the team key.
- **Your name** — kept locally to highlight your table.
- **Freshness window** — 1–12 weeks; how long before repeats are unpenalized.
- **Clear pairing history** — wipes `Y.Map<history>` for the team.

## ADRs

- [0001 — Deployment mode](docs/adr/0001-deployment-mode.md)
- [0002 — Weighted greedy bipartite matching](docs/adr/0002-weighted-greedy-matching.md)
- [0003 — ISO week as the period key](docs/adr/0003-iso-week-period-key.md)
- [0010 — GitHub Pages publishing](docs/adr/0010-pages-publishing.md)

## License

MIT © 2026 Florin Badita
