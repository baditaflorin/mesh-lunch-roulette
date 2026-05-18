import { useEffect, useState } from "react";
import { Lunch } from "./features/lunch/Lunch";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";
import { InviteShareButton } from "@baditaflorin/mesh-common";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  lookback: `${appConfig.storagePrefix}:lookback`,
  myName: `${appConfig.storagePrefix}:myName`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}
function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [lookback, setLookback] = useState(() => readNumber(STORAGE.lookback, 4));
  const [myName, setMyName] = useState(() => readString(STORAGE.myName, ""));
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.lookback, String(lookback));
  }, [lookback]);
  useEffect(() => {
    localStorage.setItem(STORAGE.myName, myName);
  }, [myName]);

  return (
    <div className="app-root">
      <Lunch roomId={roomId} lookbackWeeks={lookback} myName={myName} />

      <InviteShareButton appName={appConfig.appName} roomId={roomId} />
      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={setRoomId}
        lookback={lookback}
        onLookbackChange={setLookback}
        myName={myName}
        onMyNameChange={setMyName}
      />
    </div>
  );
}
