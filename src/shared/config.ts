export const appConfig = {
  appName: "mesh-lunch-roulette",
  storagePrefix: "mesh-lunch-roulette",
  description:
    "History-aware weekly coffee-chat pairing for teams. No two people repeat until everyone has met.",
  accentHex: "#4dcb8d",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl: "https://github.com/baditaflorin/mesh-lunch-roulette",
  pagesUrl: "https://baditaflorin.github.io/mesh-lunch-roulette/",
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
  paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
} as const;
