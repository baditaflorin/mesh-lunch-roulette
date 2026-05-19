import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { createRoomSync } from "../sync/yjsRoom";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import { isoWeek, pairWeek, type History, type Pairing } from "./pairing";

type Props = {
  roomId: string;
  lookbackWeeks: number;
  myName: string;
};

export function Lunch({ roomId, lookbackWeeks, myName }: Props) {
  const [armed, setArmed] = useState(false);
  const [newName, setNewName] = useState("");
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);

  const mesh = useMemo(() => {
    if (!armed) return null;
    const room = createRoomSync(roomId);
    const roster = room.doc.getArray<string>("roster");
    const history = room.doc.getMap<Pairing>("history");
    const state = room.doc.getMap<{ currentWeek?: string; seedBump?: number }>("state");
    return { room, roster, history, state };
  }, [armed, roomId]);

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      mesh?.room.provider?.destroy();
    };
  }, [mesh]);

  useEffect(() => {
    if (!mesh) return undefined;
    mesh.roster.observe(refresh);
    mesh.history.observe(refresh);
    mesh.state.observe(refresh);
    refresh();
    return () => {
      mesh.roster.unobserve(refresh);
      mesh.history.unobserve(refresh);
      mesh.state.unobserve(refresh);
    };
  }, [mesh]);

  if (!armed) {
    return (
      <div className="lunch-arm">
        <h1>mesh-lunch-roulette</h1>
        <p>
          History-aware coffee-chat pairing for teams. Add everyone's name to the shared roster,
          then press "Pair this week." The algorithm prefers people who have never met, falls back
          to longest-time-since for the rest, and handles odd team sizes with a wildcard triple.
        </p>
        <button type="button" className="lunch-arm-button" onClick={() => setArmed(true)}>
          Open the team room
        </button>
      </div>
    );
  }

  const roster = mesh!.roster.toArray();
  const history: History = {};
  mesh!.history.forEach((v, k) => {
    history[k] = v;
  });
  const currentWeek = mesh!.state.get("week")?.currentWeek ?? isoWeek(new Date());
  const seedBump = mesh!.state.get("week")?.seedBump ?? 0;

  const thisWeek = history[currentWeek];

  const addName = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (roster.includes(trimmed)) {
      setNewName("");
      return;
    }
    mesh!.roster.push([trimmed]);
    setNewName("");
  };

  const removeName = (name: string) => {
    const idx = roster.indexOf(name);
    if (idx >= 0) mesh!.roster.delete(idx, 1);
  };

  const pair = (rePair = false) => {
    const seed = rePair ? seedBump + 1 : seedBump;
    const result = pairWeek(mesh!.roster.toArray(), history, currentWeek, lookbackWeeks, seed);
    mesh!.room.doc.transact(() => {
      mesh!.history.set(currentWeek, result);
      mesh!.state.set("week", { currentWeek, seedBump: seed });
    });
  };

  const clearHistory = () => {
    if (!confirm("Clear all pairing history? This cannot be undone.")) return;
    mesh!.room.doc.transact(() => {
      const keys = Array.from(mesh!.history.keys());
      for (const k of keys) mesh!.history.delete(k);
    });
  };
  (window as unknown as { __lunchClearHistory?: () => void }).__lunchClearHistory = clearHistory;

  // Build past-weeks summary
  const pastWeeks = Object.keys(history)
    .filter((w) => w !== currentWeek)
    .sort()
    .reverse();

  const myPair = thisWeek ? findMyAssignment(thisWeek, myName) : null;

  return (
    <div className="lunch-stage">
      <div className="lunch-week-banner">
        <span>Week {currentWeek}</span>
        <span aria-hidden="true">·</span>
        <span>{roster.length} on roster</span>
      </div>

      {!thisWeek && (
        <section className="lunch-roster">
          <h2>Roster</h2>
          <ul>
            {roster.map((name) => (
              <li key={name}>
                <span>{name}</span>
                <button
                  type="button"
                  aria-label={`remove ${name}`}
                  onClick={() => removeName(name)}
                >
                  ×
                </button>
              </li>
            ))}
            {roster.length === 0 && <li className="lunch-empty">Add some names to begin.</li>}
          </ul>
          <div className="lunch-roster-add">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              onKeyDown={(e) => {
                if (e.key === "Enter") addName();
              }}
            />
            <button type="button" onClick={addName}>
              Add
            </button>
          </div>
          {roster.length >= 2 && (
            <button type="button" className="lunch-pair-button" onClick={() => pair(false)}>
              Pair this week ({currentWeek})
            </button>
          )}
        </section>
      )}

      {thisWeek && (
        <section className="lunch-pairs">
          <h2>Pairs for {currentWeek}</h2>
          {myName && myPair && (
            <div className="lunch-mine">
              You ({myName}) are with <strong>{myPair.others.join(", ")}</strong>
              {myPair.isTriple && <span> (triple)</span>}.
            </div>
          )}
          <ul>
            {thisWeek.pairs.map(([a, b], i) => (
              <li key={`p${i}`} className={isPairMine(a, b, myName) ? "mine" : ""}>
                {a} ↔ {b}
              </li>
            ))}
            {(thisWeek.triples ?? []).map((t, i) => (
              <li key={`t${i}`} className={`triple ${t.includes(myName) ? "mine" : ""}`}>
                {t.join(" ↔ ")} <small>(triple)</small>
              </li>
            ))}
          </ul>
          <button type="button" className="lunch-repair-button" onClick={() => pair(true)}>
            Re-pair this week
          </button>
        </section>
      )}

      {pastWeeks.length > 0 && (
        <section className="lunch-history">
          <h2>History</h2>
          {pastWeeks.map((wk) => {
            const p = history[wk]!;
            return (
              <details key={wk}>
                <summary>{wk}</summary>
                <ul>
                  {p.pairs.map(([a, b], i) => (
                    <li key={`hp${i}`}>
                      {a} ↔ {b}
                    </li>
                  ))}
                  {(p.triples ?? []).map((t, i) => (
                    <li key={`ht${i}`} className="triple">
                      {t.join(" ↔ ")}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}

function isPairMine(a: string, b: string, me: string): boolean {
  if (!me) return false;
  return a === me || b === me;
}

function findMyAssignment(p: Pairing, me: string): { others: string[]; isTriple: boolean } | null {
  if (!me) return null;
  for (const [a, b] of p.pairs) {
    if (a === me) return { others: [b], isTriple: false };
    if (b === me) return { others: [a], isTriple: false };
  }
  for (const t of p.triples ?? []) {
    if (t.includes(me)) return { others: t.filter((x) => x !== me), isTriple: true };
  }
  return null;
}

// Silence unused-import warning on Y from yjs.
void Y;
