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
    <>
      <label>
        <span>Your name (used to highlight your pair)</span>
        <input
          value={myName}
          onChange={(e) => onMyNameChange(e.target.value)}
          placeholder="(optional)"
        />
      </label>

      <label>
        <span>Lookback weeks (K = {lookback})</span>
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
        A higher K spreads pairings across more weeks before allowing repeats. Default 4.
      </p>

      <button type="button" className="settings-danger" onClick={clearHistory}>
        Clear pairing history
      </button>
    </>
  );
}
