import type { PlayEventVisibility } from "@hooma/contracts";

export function PlayVisibilityField({
  defaultValue = "OPEN",
  disabled = false,
}: {
  readonly defaultValue?: PlayEventVisibility;
  readonly disabled?: boolean;
}) {
  return (
    <fieldset className="play-visibility" disabled={disabled}>
      <legend>Match visibility</legend>
      <div className="play-visibility__options">
        <label className="play-visibility__option play-visibility__option--public">
          <input
            type="radio"
            name="visibility"
            value="OPEN"
            defaultChecked={defaultValue === "OPEN"}
          />
          <span className="play-visibility__card">
            <strong>Public</strong>
            <small>Visible in Open Matches to signed-in HOOMA users.</small>
          </span>
        </label>
        <label className="play-visibility__option play-visibility__option--private">
          <input
            type="radio"
            name="visibility"
            value="PRIVATE"
            defaultChecked={defaultValue === "PRIVATE"}
          />
          <span className="play-visibility__card">
            <strong>Private</strong>
            <small>Limited to managers, participants, and invited players.</small>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
