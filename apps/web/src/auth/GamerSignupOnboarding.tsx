import { useEffect, useMemo, useState } from "react";
import type { GamerGame } from "@hooma/contracts/gamers";
import { useHoomaFrontend, type HoomaTransport } from "@hooma/frontend";
import { createGamerOnboardingApi } from "@hooma/frontend/gamer-onboarding";

export type GamerSignupSelection = {
  readonly enabled: boolean;
  readonly games: readonly GamerGame[];
  readonly gamesLoading: boolean;
  readonly gamesError: string;
  readonly selectedGameIds: readonly string[];
  readonly handles: Readonly<Record<string, string>>;
  readonly openToChallenge: boolean;
};

export function useGamerSignupSelection() {
  const { transport } = useHoomaFrontend();
  const gamerOnboarding = useMemo(() => createGamerOnboardingApi(transport), [transport]);
  const [games, setGames] = useState<GamerGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [openToChallenge, setOpenToChallenge] = useState(false);

  useEffect(() => {
    let active = true;
    setGamesLoading(true);
    setGamesError("");
    void gamerOnboarding
      .games()
      .then((response) => {
        if (active) setGames(response.items);
      })
      .catch((reason) => {
        if (active) {
          setGamesError(reason instanceof Error ? reason.message : "Unable to load Gamer games");
        }
      })
      .finally(() => {
        if (active) setGamesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gamerOnboarding]);

  function toggleGame(gameId: string, selected: boolean) {
    setSelectedGameIds((current) =>
      selected ? [...new Set([...current, gameId])] : current.filter((id) => id !== gameId),
    );
  }

  const selection: GamerSignupSelection = {
    enabled,
    games,
    gamesLoading,
    gamesError,
    selectedGameIds,
    handles,
    openToChallenge,
  };

  return {
    selection,
    setEnabled,
    toggleGame,
    setHandle: (gameId: string, handle: string) =>
      setHandles((current) => ({ ...current, [gameId]: handle })),
    setOpenToChallenge,
  };
}

export function validateGamerSignupSelection(selection: GamerSignupSelection): string | null {
  if (!selection.enabled) return null;
  if (selection.gamesError) return "Gamer games could not be loaded. Try again before continuing.";
  const selectedGames = selection.games.filter((game) =>
    selection.selectedGameIds.includes(game.id),
  );
  if (selectedGames.length === 0) {
    return "Choose at least one game to finish Gamer setup during signup.";
  }
  const missingHandle = selectedGames.find((game) => !selection.handles[game.id]?.trim());
  return missingHandle ? `Enter your ${missingHandle.name} handle.` : null;
}

export async function completeGamerSignupOnboarding(
  selection: GamerSignupSelection,
  transport: HoomaTransport,
): Promise<void> {
  if (!selection.enabled) return;
  const gamerOnboarding = createGamerOnboardingApi(transport);
  const selectedGames = selection.games.filter((game) =>
    selection.selectedGameIds.includes(game.id),
  );
  await gamerOnboarding.joinGamers();
  await Promise.all(
    selectedGames.map((game) =>
      gamerOnboarding.saveGameProfile(game, {
        handle: selection.handles[game.id]!.trim(),
        openToChallenge: selection.openToChallenge,
      }),
    ),
  );
}

export function GamerSignupFields({
  onboarding,
}: {
  readonly onboarding: ReturnType<typeof useGamerSignupSelection>;
}) {
  const { selection } = onboarding;
  return (
    <div className="gamer-signup-onboarding">
      <label>
        <input
          type="checkbox"
          checked={selection.enabled}
          onChange={(event) => onboarding.setEnabled(event.target.checked)}
        />
        I’m a Gamer
      </label>
      {selection.enabled ? (
        <fieldset>
          <legend>Games I play</legend>
          <p>
            Choose at least one game and enter the handle you actually use there. HOOMA will create
            those game profiles now so you do not have to repeat setup in Gamers.
          </p>
          {selection.gamesLoading ? <p className="status">Loading games…</p> : null}
          {selection.gamesError ? <p className="error">{selection.gamesError}</p> : null}
          {!selection.gamesLoading && !selection.gamesError && selection.games.length === 0 ? (
            <p>No Gamer games are available yet.</p>
          ) : null}
          {selection.games.map((game) => {
            const selected = selection.selectedGameIds.includes(game.id);
            return (
              <div className="gamer-signup-game" key={game.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => onboarding.toggleGame(game.id, event.target.checked)}
                  />
                  {game.name}
                </label>
                {selected ? (
                  <label>
                    {game.name} handle
                    <input
                      value={selection.handles[game.id] ?? ""}
                      onChange={(event) => onboarding.setHandle(game.id, event.target.value)}
                      maxLength={100}
                      required
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
          <label>
            <input
              type="checkbox"
              checked={selection.openToChallenge}
              onChange={(event) => onboarding.setOpenToChallenge(event.target.checked)}
            />
            Show my selected game profiles in Challengers
          </label>
        </fieldset>
      ) : null}
    </div>
  );
}
