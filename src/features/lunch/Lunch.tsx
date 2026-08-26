import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  MeshButton,
  MeshLaunch,
  MeshPresence,
  MeshShellConnectionBridge,
  MeshStatusPill,
  MeshSurface,
  type YRoom,
} from "@baditaflorin/mesh-common";
import { createRoomSync } from "../sync/yjsRoom";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import { isoWeek, pairWeek, type History, type Pairing } from "./pairing";

type Props = {
  roomId: string;
  lookbackWeeks: number;
  myName: string;
};

type Awareness = {
  getStates: () => Map<number, unknown>;
  on: (event: "change", listener: () => void) => void;
  off: (event: "change", listener: () => void) => void;
};

function awarenessFor(provider: unknown): Awareness | null {
  const awareness = (provider as { awareness?: Awareness } | null)?.awareness;
  return awareness ?? null;
}

export function Lunch({ roomId, lookbackWeeks, myName }: Props) {
  const [newName, setNewName] = useState("");
  const [, setRevision] = useState(0);
  const [peerCount, setPeerCount] = useState(0);
  const refresh = useCallback(() => setRevision((revision) => revision + 1), []);

  // The board is intentionally live from the first render. The shared roster
  // is the product's entry point, not an empty preflight screen hidden behind
  // a generic "open" action.
  const mesh = useMemo(() => {
    const room = createRoomSync(roomId);
    const roster = room.doc.getArray<string>("roster");
    const history = room.doc.getMap<Pairing>("history");
    const state = room.doc.getMap<{ currentWeek?: string; seedBump?: number }>("state");
    return { room, roster, history, state };
  }, [roomId]);

  useEffect(() => {
    void maybeFetchTurnCredentials();
  }, [roomId]);

  useEffect(() => {
    return () => {
      mesh.room.provider?.destroy();
      mesh.room.doc.destroy();
    };
  }, [mesh]);

  useEffect(() => {
    mesh.roster.observe(refresh);
    mesh.history.observe(refresh);
    mesh.state.observe(refresh);
    refresh();
    return () => {
      mesh.roster.unobserve(refresh);
      mesh.history.unobserve(refresh);
      mesh.state.unobserve(refresh);
    };
  }, [mesh, refresh]);

  useEffect(() => {
    const awareness = awarenessFor(mesh.room.provider);
    const update = () => {
      // Awareness includes this browser, so the number of remote peers is one
      // less than its state count. A provider-free fallback is deliberately
      // quiet rather than pretending the room is connected.
      setPeerCount(Math.max(0, (awareness?.getStates().size ?? 1) - 1));
    };
    update();
    awareness?.on("change", update);
    return () => awareness?.off("change", update);
  }, [mesh]);

  const roster = mesh.roster.toArray();
  const history: History = {};
  mesh.history.forEach((value, key) => {
    history[key] = value;
  });
  const currentWeek = mesh.state.get("week")?.currentWeek ?? isoWeek(new Date());
  const seedBump = mesh.state.get("week")?.seedBump ?? 0;
  const thisWeek = history[currentWeek];
  const pastWeeks = Object.keys(history)
    .filter((week) => week !== currentWeek)
    .sort()
    .reverse();
  const myPair = thisWeek ? findMyAssignment(thisWeek, myName) : null;

  const roomForShell = useMemo<YRoom>(
    () => ({
      doc: mesh.room.doc,
      provider: mesh.room.provider,
      peerId: mesh.room.peerId,
      peerCount,
      roomId,
    }),
    [mesh, peerCount, roomId],
  );

  const addName = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (roster.includes(trimmed)) {
      setNewName("");
      return;
    }
    mesh.roster.push([trimmed]);
    setNewName("");
  }, [mesh.roster, newName, roster]);

  const removeName = useCallback(
    (name: string) => {
      const index = roster.indexOf(name);
      if (index >= 0) mesh.roster.delete(index, 1);
    },
    [mesh.roster, roster],
  );

  const pair = useCallback(
    (rePair = false) => {
      const seed = rePair ? seedBump + 1 : seedBump;
      const result = pairWeek(mesh.roster.toArray(), history, currentWeek, lookbackWeeks, seed);
      mesh.room.doc.transact(() => {
        mesh.history.set(currentWeek, result);
        mesh.state.set("week", { currentWeek, seedBump: seed });
      });
    },
    [currentWeek, history, lookbackWeeks, mesh, seedBump],
  );

  const clearHistory = useCallback(() => {
    if (!confirm("Clear all pairing history? This cannot be undone.")) return;
    mesh.room.doc.transact(() => {
      const keys = Array.from(mesh.history.keys());
      for (const key of keys) mesh.history.delete(key);
    });
  }, [mesh]);

  useEffect(() => {
    const host = window as typeof window & { __lunchClearHistory?: () => void };
    host.__lunchClearHistory = clearHistory;
    return () => {
      if (host.__lunchClearHistory === clearHistory) delete host.__lunchClearHistory;
    };
  }, [clearHistory]);

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addName();
  };

  const peopleHere = peerCount + 1;
  const presence = (
    <MeshPresence
      count={peopleHere}
      label={peopleHere === 1 ? "device at this table" : "devices at this table"}
      state={peerCount > 0 ? "connected" : "idle"}
      announce="polite"
    />
  );

  return (
    <>
      <MeshShellConnectionBridge room={roomForShell} />
      <main className="lunch-page" aria-label="Lunch Table">
        {thisWeek ? (
          <PairingOutcome
            currentWeek={currentWeek}
            pairing={thisWeek}
            myName={myName}
            myPair={myPair}
            roster={roster}
            presence={presence}
            onRePair={() => pair(true)}
          />
        ) : (
          <MeshLaunch
            className="lunch-launch"
            eyebrow={`Shared lunch decision · Week ${currentWeek}`}
            heading="Make lunch feel less like another meeting."
            promise="Build one shared table, then make a clear choice for the week. Fresh pairings keep the conversation moving."
            presence={presence}
            preview={
              <RosterEditor
                roster={roster}
                newName={newName}
                onNameChange={setNewName}
                onSubmit={submitName}
                onRemove={removeName}
              />
            }
            primaryAction={{
              label: "Choose this week’s table",
              onClick: () => pair(false),
              disabled: roster.length < 2,
              "aria-describedby": "lunch-roster-advice",
              className: "lunch-choose-action",
            }}
            connectionHint={
              roster.length >= 2
                ? "Every change is shared with the people in this room."
                : "Add at least two names, then choose the table."
            }
          />
        )}

        {pastWeeks.length > 0 && <PairingHistory history={history} weeks={pastWeeks} />}
      </main>
    </>
  );
}

function RosterEditor({
  roster,
  newName,
  onNameChange,
  onSubmit,
  onRemove,
}: {
  roster: string[];
  newName: string;
  onNameChange: (next: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemove: (name: string) => void;
}) {
  const ready = roster.length >= 2;

  return (
    <MeshSurface
      as="section"
      tone="raised"
      padding="lg"
      className="lunch-roster lunch-decision-card"
      aria-labelledby="shared-roster-title"
      data-testid="shared-roster"
    >
      <div className="lunch-section-heading">
        <div>
          <p className="lunch-kicker">Shared roster</p>
          <h2 id="shared-roster-title">Who is joining?</h2>
        </div>
        <MeshStatusPill tone={ready ? "success" : "neutral"} dot>
          {ready ? `${roster.length} ready` : "Add your people"}
        </MeshStatusPill>
      </div>

      <p id="lunch-roster-advice" className="lunch-roster-advice">
        {ready
          ? "The table is ready to decide. You can still refine the list before choosing."
          : "Names are shared in real time with everyone using this room."}
      </p>

      <ul className="lunch-roster-list" aria-live="polite">
        {roster.map((name) => (
          <li key={name}>
            <span>{name}</span>
            <MeshButton
              type="button"
              variant="quiet"
              size="sm"
              className="lunch-roster-remove"
              aria-label={`Remove ${name}`}
              onClick={() => onRemove(name)}
            >
              Remove
            </MeshButton>
          </li>
        ))}
        {roster.length === 0 && <li className="lunch-empty">Start with the people around you.</li>}
      </ul>

      <form className="lunch-roster-add" onSubmit={onSubmit}>
        <label htmlFor="lunch-new-name">Add a person</label>
        <div className="lunch-roster-control-row">
          <input
            id="lunch-new-name"
            value={newName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Name"
            maxLength={48}
            autoComplete="off"
          />
          <MeshButton type="submit" variant="secondary">
            Add
          </MeshButton>
        </div>
      </form>
    </MeshSurface>
  );
}

function PairingOutcome({
  currentWeek,
  pairing,
  myName,
  myPair,
  roster,
  presence,
  onRePair,
}: {
  currentWeek: string;
  pairing: Pairing;
  myName: string;
  myPair: { others: string[]; isTriple: boolean } | null;
  roster: string[];
  presence: React.ReactNode;
  onRePair: () => void;
}) {
  return (
    <div className="lunch-outcome">
      <header className="lunch-outcome-header">
        <div>
          <p className="lunch-kicker">Shared decision · Week {currentWeek}</p>
          <h1>The table is set.</h1>
          <p>Fresh conversations, one clear plan.</p>
        </div>
        <div className="lunch-outcome-status">
          {presence}
          <MeshStatusPill tone="success" dot>
            Shared result
          </MeshStatusPill>
        </div>
      </header>

      <div className="lunch-outcome-grid">
        <MeshSurface
          as="section"
          tone="accent"
          padding="lg"
          className="lunch-pairs lunch-pairing-surface"
          aria-labelledby="pairings-title"
        >
          <div className="lunch-section-heading">
            <div>
              <p className="lunch-kicker">This week’s table</p>
              <h2 id="pairings-title">Pairings with room for a new conversation.</h2>
            </div>
            <MeshStatusPill tone="live" dot>
              {pairing.pairs.length + (pairing.triples?.length ?? 0)} tables
            </MeshStatusPill>
          </div>

          {myName && myPair && (
            <div className="lunch-mine">
              <span>Your table</span>
              <strong>{myPair.others.join(" and ")}</strong>
              {myPair.isTriple && <small>Three people this week</small>}
            </div>
          )}

          <ul className="lunch-pair-list" data-testid="pairing-list">
            {pairing.pairs.map(([first, second], index) => (
              <li
                key={`pair-${index}`}
                className={isPairMine(first, second, myName) ? "mine" : undefined}
              >
                <span className="lunch-pair-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="lunch-pair-people">
                  <span>{first}</span>
                  <span className="lunch-pair-divider" aria-hidden="true">
                    —
                  </span>
                  <span>{second}</span>
                </span>
              </li>
            ))}
            {(pairing.triples ?? []).map((triple, index) => (
              <li
                key={`triple-${index}`}
                className={`triple ${triple.includes(myName) ? "mine" : ""}`}
              >
                <span className="lunch-pair-number" aria-hidden="true">
                  {String(pairing.pairs.length + index + 1).padStart(2, "0")}
                </span>
                <span className="lunch-pair-people">{triple.join(" — ")}</span>
                <MeshStatusPill tone="warning" size="sm">
                  Three people
                </MeshStatusPill>
              </li>
            ))}
          </ul>

          <MeshButton type="button" variant="secondary" fullWidth onClick={onRePair}>
            Choose another table
          </MeshButton>
        </MeshSurface>

        <MeshSurface as="aside" tone="quiet" padding="lg" className="lunch-roster-summary">
          <p className="lunch-kicker">The shared roster</p>
          <h2>{roster.length} people are in this decision.</h2>
          <ul>
            {roster.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p>Need to change the list? Start a new choice once the next week begins.</p>
        </MeshSurface>
      </div>
    </div>
  );
}

function PairingHistory({ history, weeks }: { history: History; weeks: string[] }) {
  return (
    <MeshSurface
      as="section"
      tone="quiet"
      padding="md"
      className="lunch-history"
      aria-labelledby="history-title"
    >
      <div className="lunch-section-heading">
        <div>
          <p className="lunch-kicker">Earlier tables</p>
          <h2 id="history-title">Conversation history</h2>
        </div>
        <MeshStatusPill tone="neutral">{weeks.length} weeks</MeshStatusPill>
      </div>
      {weeks.map((week) => {
        const pairing = history[week]!;
        return (
          <details key={week}>
            <summary>{week}</summary>
            <ul>
              {pairing.pairs.map(([first, second], index) => (
                <li key={`history-pair-${index}`}>
                  {first} — {second}
                </li>
              ))}
              {(pairing.triples ?? []).map((triple, index) => (
                <li key={`history-triple-${index}`} className="triple">
                  {triple.join(" — ")} <span>Three people</span>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </MeshSurface>
  );
}

function isPairMine(first: string, second: string, me: string): boolean {
  if (!me) return false;
  return first === me || second === me;
}

function findMyAssignment(
  pairing: Pairing,
  me: string,
): { others: string[]; isTriple: boolean } | null {
  if (!me) return null;
  for (const [first, second] of pairing.pairs) {
    if (first === me) return { others: [second], isTriple: false };
    if (second === me) return { others: [first], isTriple: false };
  }
  for (const triple of pairing.triples ?? []) {
    if (triple.includes(me))
      return { others: triple.filter((name) => name !== me), isTriple: true };
  }
  return null;
}
