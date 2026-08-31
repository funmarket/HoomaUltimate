import type { RideContext } from "@hooma/contracts/rides";

const RIDE_CONTEXTS: readonly {
  readonly value: RideContext;
  readonly label: string;
  readonly help: string;
}[] = [
  { value: "MATCHDAY", label: "Matchday Ride", help: "Football, stadiums and events." },
  {
    value: "GENERAL",
    label: "Anywhere Ride",
    help: "Airport, work, school, home or another city.",
  },
];

export function initialRideContext(): RideContext {
  return rideContextFromQuery() ?? "MATCHDAY";
}

export function rideContextFromQuery(): RideContext | undefined {
  const value = new URLSearchParams(window.location.search).get("context");
  return value === "GENERAL" || value === "MATCHDAY" ? value : undefined;
}

export function contextQuery(context: RideContext | undefined): string {
  return context ? `?context=${context}` : "";
}

export function RideContextSelector({
  value,
  onChange,
}: {
  readonly value: RideContext;
  readonly onChange: (value: RideContext) => void;
}) {
  return (
    <fieldset className="ride-form-section ride-context-selector">
      <legend className="eyebrow">RIDE TYPE</legend>
      <div className="ride-segmented" role="radiogroup" aria-label="Ride type">
        {RIDE_CONTEXTS.map((context) => (
          <button
            aria-checked={value === context.value}
            className="ride-segmented__option"
            key={context.value}
            role="radio"
            type="button"
            onClick={() => onChange(context.value)}
          >
            <strong>{context.label}</strong>
            <span>{context.help}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
