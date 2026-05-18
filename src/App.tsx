import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { Lunch } from "./features/lunch/Lunch";
import { SettingsExtras } from "./features/settings/SettingsExtras";
import { appConfig } from "./shared/config";

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
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={
        <SettingsExtras
          lookback={lookback}
          onLookbackChange={setLookback}
          myName={myName}
          onMyNameChange={setMyName}
        />
      }
    >
      <Lunch roomId={roomId} lookbackWeeks={lookback} myName={myName} />
    </MeshShell>
  );
}
