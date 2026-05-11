# Privacy threat model — mesh-lunch-roulette

## What other peers in the same room can see

- The shared **roster** of names.
- The shared **history** of pairings per ISO week.
- The current week label and the re-pair seed counter.

That's the entire payload. Names in the roster are visible to every peer in
the room. **Don't put email addresses, IDs, or anything that isn't a
friendly first-name-or-nickname into the roster.**

## What stays local

- Your **room ID** (the team identifier) and **your own name** (used to
  highlight your assigned pair on this device) are in `localStorage`. Your
  name choice is also broadcast — when you push your name into the roster
  you've revealed it to the room. The "myName" highlight setting itself
  doesn't broadcast; it just remembers what to highlight in the UI.
- The **lookback K** (1–12 weeks) is local to your device.

## What the signaling server can see

`signaling-server` sees the **room name**
(`mesh-lunch-roulette:<roomId>`) and encrypted SDP. It does **not** see the
roster or history — those flow peer-to-peer over WebRTC DataChannel.

## What the TURN server can see

`coturn-hetzner` relays encrypted bytes if direct peer-to-peer fails. Cannot
decrypt the payload.

## Permissions asked

None. No camera, no microphone, no motion, no notifications.

## Practical guidance

- The room ID **is** the team key. Anyone with the room ID can join the
  room, see the roster, edit it, and see the pairings. Choose a room ID
  that is hard to guess (e.g. `team-${randomToken}`) and share it
  out-of-band.
- The data is replicated peer-to-peer; if no peer is online, the document
  is not available. Yjs is CRDT-replicated **on each peer** — if you all go
  offline at once and rejoin later, you'll keep your local state. If the
  team rebuilds the room from one phone, the history on that phone is the
  authoritative starting state.

## What's NOT in the threat model

- Server-side persistence. The signaling/TURN servers do not see or store
  application content.
- Mass surveillance of who-meets-whom. Network observers can see the
  WebSocket connection to `turn.0docker.com`; they cannot decrypt the
  payload.
