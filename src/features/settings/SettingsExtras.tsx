import { MeshButton, MeshNameInput } from "@baditaflorin/mesh-common";

type Props = {
  lookback: number;
  onLookbackChange: (next: number) => void;
  myName: string;
  onMyNameChange: (next: string) => void;
};

export function SettingsExtras({ lookback, onLookbackChange, myName, onMyNameChange }: Props) {
  const clearHistory = () => {
    const fn = (window as unknown as { __lunchClearHistory?: () => void }).__lunchClearHistory;
    if (fn) fn();
  };

  return (
    <section className="lunch-settings" aria-label="Lunch preferences">
      <MeshNameInput
        value={myName}
        onChange={onMyNameChange}
        label="Your name"
        placeholder="Used to highlight your table"
        hint="This stays on this device; it is not added to the shared roster automatically."
        showCounter
        maxLength={48}
      />

      <label>
        <span>Freshness window — {lookback} weeks</span>
        <input
          type="range"
          min={1}
          max={12}
          step={1}
          value={lookback}
          onChange={(e) => onLookbackChange(Number(e.target.value))}
        />
      </label>

      <p className="mesh-settings-help">
        A longer window keeps recent tables apart before allowing a repeat. Default: 4 weeks.
      </p>

      <MeshButton type="button" variant="danger" size="sm" onClick={clearHistory}>
        Clear pairing history
      </MeshButton>
    </section>
  );
}
