import { createMeshConfig } from "@baditaflorin/mesh-common";

export const appConfig = createMeshConfig({
  appName: "mesh-lunch-roulette",
  displayName: "Lunch Table",
  visualProfile: "play",
  shellLayout: "inset",
  description:
    "A shared, history-aware way for teams to make this week's lunch pairing without repeating the same conversations.",
  accentHex: "#e0b44c",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
});
