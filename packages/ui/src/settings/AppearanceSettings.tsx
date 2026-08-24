export type AppearanceMode = "system" | "telegram" | "dark" | "light" | "future-pitch";

export function AppearanceSettings({
  mode,
  choices,
  onChange,
}: {
  readonly mode: AppearanceMode;
  readonly choices: readonly { value: AppearanceMode; label: string; description: string }[];
  readonly onChange: (mode: AppearanceMode) => void;
}) {
  return (
    <section className="hooma-settings-panel">
      <p className="eyebrow">APPEARANCE</p>
      <h2>Settings</h2>
      <div className="hooma-settings-options" role="radiogroup" aria-label="Appearance">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            className="hooma-settings-option"
            role="radio"
            aria-checked={mode === choice.value}
            onClick={() => onChange(choice.value)}
          >
            <span>
              <strong>{choice.label}</strong>
              <small>{choice.description}</small>
            </span>
            <span className="hooma-settings-option__check" aria-hidden="true">
              {mode === choice.value ? "✓" : ""}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
