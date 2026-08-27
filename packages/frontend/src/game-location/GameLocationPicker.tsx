import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicPlaceCapability } from "@hooma/contracts/platform-management";

type LocationMode = "none" | "pitch" | "manual";

export function GameLocationPicker({
  pitches,
  disabled = false,
}: {
  readonly pitches: readonly PublicPlaceCapability[];
  readonly disabled?: boolean;
}) {
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const [mode, setMode] = useState<LocationMode>("none");
  const [query, setQuery] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");

  useEffect(() => {
    const form = fieldsetRef.current?.form;
    if (!form) return;
    const handleReset = () => {
      setMode("none");
      setQuery("");
      setSelectedPlaceId("");
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return pitches;
    return pitches.filter(({ place }) =>
      [place.name, place.city, place.houma, place.address]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [pitches, query]);

  const selected = pitches.find((pitch) => pitch.place.id === selectedPlaceId) ?? null;

  function chooseMode(nextMode: LocationMode) {
    setMode(nextMode);
    if (nextMode !== "pitch") {
      setSelectedPlaceId("");
      setQuery("");
    }
  }

  return (
    <fieldset ref={fieldsetRef} className="game-location-picker" disabled={disabled}>
      <legend>
        <span>Where are you playing?</span>
        <small>Optional</small>
      </legend>
      <p className="game-location-picker__intro">
        Tag an approved HOOMA Pitch, add a one-off location, or leave the venue open for now.
      </p>

      <div className="game-location-picker__choices" role="group" aria-label="Game location type">
        <button
          className={mode === "pitch" ? "is-active" : ""}
          type="button"
          aria-pressed={mode === "pitch"}
          onClick={() => chooseMode("pitch")}
        >
          Choose HOOMA Pitch
        </button>
        <button
          className={mode === "manual" ? "is-active" : ""}
          type="button"
          aria-pressed={mode === "manual"}
          onClick={() => chooseMode("manual")}
        >
          Add game location
        </button>
        {mode !== "none" ? (
          <button
            className="game-location-picker__clear"
            type="button"
            onClick={() => chooseMode("none")}
          >
            Clear
          </button>
        ) : null}
      </div>

      {mode === "pitch" ? (
        <div className="game-location-picker__pitch-mode">
          <label className="game-location-picker__search">
            <span>Search approved Pitches</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pitch, city or houma"
              autoComplete="off"
            />
          </label>
          <input type="hidden" name="placeId" value={selectedPlaceId} />

          {selected ? (
            <div className="game-location-picker__selected">
              {selected.place.imageUrl ? (
                <img src={selected.place.imageUrl} alt="" />
              ) : (
                <span className="game-location-picker__image-placeholder" aria-hidden="true">
                  ⚽
                </span>
              )}
              <div>
                <small>Selected HOOMA Pitch</small>
                <strong>{selected.place.name}</strong>
                <span>
                  {[selected.place.city, selected.place.houma].filter(Boolean).join(" · ")}
                </span>
              </div>
              <button type="button" onClick={() => setSelectedPlaceId("")}>
                Change
              </button>
            </div>
          ) : (
            <div className="game-location-picker__results">
              {filtered.length ? (
                filtered.slice(0, 12).map((pitch) => (
                  <button
                    key={pitch.place.id}
                    type="button"
                    className="game-location-picker__result"
                    onClick={() => setSelectedPlaceId(pitch.place.id)}
                  >
                    {pitch.place.imageUrl ? (
                      <img src={pitch.place.imageUrl} alt="" />
                    ) : (
                      <span>⚽</span>
                    )}
                    <span>
                      <strong>{pitch.place.name}</strong>
                      <small>
                        {[pitch.place.city, pitch.place.houma].filter(Boolean).join(" · ") ||
                          pitch.place.address}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <p className="game-location-picker__empty">
                  No approved HOOMA Pitch matches that search.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}

      {mode === "manual" ? (
        <div className="game-location-picker__manual">
          <label>
            <span>Location name</span>
            <input name="venueName" maxLength={120} placeholder="e.g. Municipal field" />
          </label>
          <label>
            <span>Address</span>
            <input name="address" maxLength={240} placeholder="Street, area or meeting point" />
          </label>
          <small>
            This stays attached only to this game. It does not create a HOOMA Pitch listing.
          </small>
        </div>
      ) : null}
    </fieldset>
  );
}
