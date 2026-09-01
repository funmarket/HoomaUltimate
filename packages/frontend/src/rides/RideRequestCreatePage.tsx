import type { MeResponse } from "@hooma/contracts";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  PublicRideRequest,
  RideRequestAudienceCommand,
  RideRequestCreateInput,
  RideRequestForOwner,
  RideRequestUpdateInput,
} from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { RideCompensationBadge } from "./RideCompensationBadge";
import {
  RideCompensationFields,
  buildRideRequestCompensationTerms,
  compensationFormStateFromTerms,
  defaultRideCompensationState,
} from "./RideCompensationFields";
import { RideContextSelector, contextQuery, initialRideContext } from "./RideContextSelector";
import { RideDestinationFields } from "./RideDestinationFields";
import { RideSectionHeader } from "./RideSectionHeader";
import {
  dateTimeInputValue,
  dateTimeInputValueFromIso,
  destinationFormState,
  destinationInput,
  destinationLabel,
  emptyDestination,
  toIsoDateTime,
} from "./ride-view-model";

type RideRequestAudienceChoice = "GLOBAL" | "ONE" | "ALL_CURRENT";
type HoomaMembership = MeResponse["communities"][number];

const communityAudienceCopy = "Join or create a HOOMA to share this Ride request with a community.";

function buildRideRequestAudience(
  choice: RideRequestAudienceChoice,
  selectedCommunityId: string,
): RideRequestAudienceCommand {
  if (choice === "ONE") {
    return { scope: "COMMUNITY", selection: "ONE", communityId: selectedCommunityId };
  }
  if (choice === "ALL_CURRENT") {
    return { scope: "COMMUNITY", selection: "ALL_CURRENT" };
  }
  return { scope: "GLOBAL" };
}

function audienceChoiceFromOwner(request: RideRequestForOwner): RideRequestAudienceChoice {
  if (request.audience.scope === "GLOBAL") return "GLOBAL";
  return request.audience.communities.length === 1 ? "ONE" : "ALL_CURRENT";
}

function audienceSuccessMessage(request: RideRequestForOwner, editing: boolean): string {
  const prefix = editing ? "Your Ride request is updated" : "Your Ride request is live";
  if (request.audience.scope === "GLOBAL") return `${prefix} in Ride.`;
  const count = request.audience.communities.length;
  if (count === 1) {
    return `${prefix} in HOOMA NOW for ${request.audience.communities[0]?.name}.`;
  }
  return `${prefix} in HOOMA NOW for ${count} HOOMAs.`;
}

export function RideRequestCreatePage({ requestId }: { readonly requestId?: string }) {
  const { api: hoomaApi, transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const editing = Boolean(requestId);
  const [rideContext, setRideContext] = useState(initialRideContext());
  const [destination, setDestination] = useState(emptyDestination);
  const [pickupAreaLabel, setPickupAreaLabel] = useState("");
  const [desiredDepartureAt, setDesiredDepartureAt] = useState(dateTimeInputValue(90));
  const [expiresAt, setExpiresAt] = useState(dateTimeInputValue(24 * 60));
  const [passengerCount, setPassengerCount] = useState("1");
  const [compensation, setCompensation] = useState(defaultRideCompensationState);
  const [note, setNote] = useState("");
  const [audienceChoice, setAudienceChoice] = useState<RideRequestAudienceChoice>("GLOBAL");
  const [audienceDirty, setAudienceDirty] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [memberships, setMemberships] = useState<HoomaMembership[]>([]);
  const [existingRequest, setExistingRequest] = useState<RideRequestForOwner | null>(null);
  const [savedRequest, setSavedRequest] = useState<RideRequestForOwner | null>(null);
  const [publicRequests, setPublicRequests] = useState<PublicRideRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingMemberships, setLoadingMemberships] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasCommunityMemberships = memberships.length > 0;
  const communityAudienceInvalid =
    editing && !audienceDirty
      ? false
      : (audienceChoice === "ONE" && !selectedCommunityId) ||
        ((audienceChoice === "ONE" || audienceChoice === "ALL_CURRENT") &&
          !hasCommunityMemberships);

  useEffect(() => {
    if (!requestId) return;
    let active = true;
    setLoadingExisting(true);
    setError("");
    void api
      .manageRequest(requestId)
      .then((request) => {
        if (!active) return;
        setExistingRequest(request);
        setRideContext(request.context);
        setDestination(destinationFormState(request.destination));
        setPickupAreaLabel(request.pickupAreaLabel);
        setDesiredDepartureAt(dateTimeInputValueFromIso(request.desiredDepartureAt));
        setExpiresAt(dateTimeInputValueFromIso(request.expiresAt));
        setPassengerCount(String(request.passengerCount));
        setCompensation(compensationFormStateFromTerms(request.compensationTerms));
        setNote(request.note ?? "");
        const choice = audienceChoiceFromOwner(request);
        setAudienceChoice(choice);
        setAudienceDirty(false);
        if (request.audience.scope === "COMMUNITY") {
          setSelectedCommunityId(request.audience.communities[0]?.id ?? "");
        }
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to load this Ride request"));
      })
      .finally(() => {
        if (active) setLoadingExisting(false);
      });
    return () => {
      active = false;
    };
  }, [api, protectedError, requestId]);

  useEffect(() => {
    if (editing) {
      setLoadingRequests(false);
      setPublicRequests([]);
      return;
    }
    let active = true;
    setLoadingRequests(true);
    void api
      .listRequests({ limit: 10, context: rideContext })
      .then((page) => {
        if (active) setPublicRequests(page.items);
      })
      .catch(() => {
        if (active) setPublicRequests([]);
      })
      .finally(() => {
        if (active) setLoadingRequests(false);
      });
    return () => {
      active = false;
    };
  }, [api, editing, rideContext]);

  useEffect(() => {
    let active = true;
    setLoadingMemberships(true);
    void hoomaApi.identity
      .meOptional()
      .then((me) => {
        if (!active) return;
        const rows = me?.communities ?? [];
        setMemberships(rows);
        setSelectedCommunityId((current) =>
          current && rows.some((community) => community.id === current) ? current : (rows[0]?.id ?? ""),
        );
        if (!rows.length && !editing) setAudienceChoice("GLOBAL");
      })
      .catch(() => {
        if (!active) return;
        setMemberships([]);
        if (!editing) {
          setSelectedCommunityId("");
          setAudienceChoice("GLOBAL");
        }
      })
      .finally(() => {
        if (active) setLoadingMemberships(false);
      });
    return () => {
      active = false;
    };
  }, [editing, hoomaApi]);

  const readOnly =
    existingRequest?.status === "CANCELLED" ||
    existingRequest?.status === "EXPIRED" ||
    existingRequest?.status === "COMPLETED";

  function chooseAudience(choice: RideRequestAudienceChoice) {
    setAudienceChoice(choice);
    setAudienceDirty(true);
    if (choice === "ONE" && !memberships.some((community) => community.id === selectedCommunityId)) {
      setSelectedCommunityId(memberships[0]?.id ?? "");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    if (communityAudienceInvalid) {
      setError(communityAudienceCopy);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const baseInput = {
        context: rideContext,
        destination: destinationInput(destination),
        pickupAreaLabel: pickupAreaLabel.trim(),
        desiredDepartureAt: toIsoDateTime(desiredDepartureAt),
        passengerCount: Number(passengerCount),
        compensationTerms: buildRideRequestCompensationTerms(compensation),
        note: note.trim() || null,
        expiresAt: toIsoDateTime(expiresAt),
      };

      const saved = requestId
        ? await api.updateRequest(requestId, {
            ...baseInput,
            ...(audienceDirty
              ? { audience: buildRideRequestAudience(audienceChoice, selectedCommunityId) }
              : {}),
          } satisfies RideRequestUpdateInput)
        : await api.createRequest({
            ...baseInput,
            audience: buildRideRequestAudience(audienceChoice, selectedCommunityId),
          } satisfies RideRequestCreateInput);
      setExistingRequest(saved);
      setSavedRequest(saved);
      setAudienceDirty(false);
    } catch (reason) {
      setError(
        protectedError(
          reason,
          editing ? "Unable to update Ride request" : "Unable to create Ride request",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (editing && loadingExisting) {
    return <p className="ride-state panel">Loading your Ride request...</p>;
  }

  if (editing && !existingRequest && error) {
    return <p className="ride-state panel error">{error}</p>;
  }

  return (
    <section className="ride-page ride-form-page">
      <RideSectionHeader
        eyebrow={editing ? "MY REQUESTS" : "TAKE ME TO THE GAME"}
        title={editing ? "Edit Ride request" : "Request a Ride"}
        body={
          editing
            ? "Update the same canonical RideRequest. Its My Rides ownership and HOOMA NOW projections follow the saved Ride state."
            : "Create a real RideRequest. This does not create fake matching, fare collection, drivers, or bookings."
        }
        actionHref={editing ? "/rides/mine" : `/rides/offers${contextQuery(rideContext)}`}
        actionLabel={editing ? "Back to My Rides" : "Browse offers"}
      />

      {readOnly ? (
        <p className="ride-state panel">
          This Ride request is {existingRequest?.status.toLowerCase()} and is read-only.
        </p>
      ) : null}

      {savedRequest ? (
        <section className="ride-created panel">
          <p className="eyebrow">{editing ? "RIDE REQUEST UPDATED" : "RIDE REQUEST CREATED"}</p>
          <h2>{destinationLabel(savedRequest.destination)}</h2>
          <RideCompensationBadge terms={savedRequest.compensationTerms} mode="request" />
          <p>{audienceSuccessMessage(savedRequest, editing)}</p>
          <p>
            {editing
              ? "This is still the same RideRequest. Discovery and HOOMA NOW read the updated canonical record."
              : `One canonical RideRequest is live from ${savedRequest.pickupAreaLabel}. Matching remains a later Ride-owned capability.`}
          </p>
          <div className="ride-actions">
            <a className="ride-button ride-button--primary" href="/rides/mine">
              Back to My Rides
            </a>
            {!editing ? (
              <a className="ride-button" href={`/rides/request${contextQuery(rideContext)}`}>
                Create another
              </a>
            ) : null}
          </div>
        </section>
      ) : readOnly ? null : (
        <form className="ride-form panel" onSubmit={submit}>
          <section className="ride-form-section">
            <p className="eyebrow">TRIP</p>
            <RideContextSelector value={rideContext} onChange={setRideContext} />
            <RideDestinationFields
              context={rideContext}
              destination={destination}
              onChange={setDestination}
            />
            <label className="ride-field">
              <span>Pickup area</span>
              <input
                value={pickupAreaLabel}
                onChange={(event) => setPickupAreaLabel(event.target.value)}
                placeholder="Public area only, not an exact private address"
                required
              />
            </label>
            <label className="ride-field">
              <span>Desired departure</span>
              <input
                type="datetime-local"
                value={desiredDepartureAt}
                onChange={(event) => setDesiredDepartureAt(event.target.value)}
                required
              />
            </label>
          </section>
          <section className="ride-form-section">
            <p className="eyebrow">SEATS</p>
            <label className="ride-field">
              <span>Passengers</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={passengerCount}
                onChange={(event) => setPassengerCount(event.target.value)}
                required
              />
            </label>
          </section>
          <RideCompensationFields mode="request" value={compensation} onChange={setCompensation} />
          <section className="ride-form-section ride-share-with">
            <div className="ride-form-section__header">
              <p className="eyebrow">SHARE WITH</p>
            </div>
            <fieldset className="ride-audience-choice" aria-describedby="ride-audience-help">
              <legend>Who should see this Ride request?</legend>
              <label className={audienceChoice === "GLOBAL" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="ride-request-audience"
                  value="GLOBAL"
                  checked={audienceChoice === "GLOBAL"}
                  onChange={() => chooseAudience("GLOBAL")}
                />
                <span>
                  <strong>Everyone</strong>
                  <small>Visible in normal Ride request discovery.</small>
                </span>
              </label>
              <label
                className={audienceChoice === "ONE" ? "is-selected" : ""}
                aria-disabled={!hasCommunityMemberships}
              >
                <input
                  type="radio"
                  name="ride-request-audience"
                  value="ONE"
                  checked={audienceChoice === "ONE"}
                  disabled={!hasCommunityMemberships}
                  onChange={() => chooseAudience("ONE")}
                />
                <span>
                  <strong>One of my HOOMAs</strong>
                  <small>Only members of the HOOMA you choose can see it.</small>
                </span>
              </label>
              <label
                className={audienceChoice === "ALL_CURRENT" ? "is-selected" : ""}
                aria-disabled={!hasCommunityMemberships}
              >
                <input
                  type="radio"
                  name="ride-request-audience"
                  value="ALL_CURRENT"
                  checked={audienceChoice === "ALL_CURRENT"}
                  disabled={!hasCommunityMemberships}
                  onChange={() => chooseAudience("ALL_CURRENT")}
                />
                <span>
                  <strong>All my HOOMAs</strong>
                  <small>Share with every HOOMA where you are currently a member.</small>
                </span>
              </label>
            </fieldset>
            {audienceChoice === "ONE" && hasCommunityMemberships ? (
              <label className="ride-field ride-community-select">
                <span>Choose one HOOMA</span>
                <select
                  value={selectedCommunityId}
                  onChange={(event) => {
                    setSelectedCommunityId(event.target.value);
                    setAudienceDirty(true);
                  }}
                  required
                >
                  {memberships.map((community) => (
                    <option key={community.id} value={community.id}>
                      {community.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {!loadingMemberships && !hasCommunityMemberships ? (
              <p className="ride-audience-note" id="ride-audience-help">
                {communityAudienceCopy}
              </p>
            ) : (
              <p className="ride-audience-note" id="ride-audience-help">
                All my HOOMAs is resolved by the server when this request is saved.
              </p>
            )}
          </section>
          <section className="ride-form-section">
            <p className="eyebrow">DETAILS</p>
            <label className="ride-field">
              <span>Request expires</span>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                required
              />
            </label>
            <label className="ride-field">
              <span>Note</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </label>
          </section>
          {error ? <p className="error">{error}</p> : null}
          <button
            className="ride-button ride-button--primary"
            type="submit"
            disabled={saving || communityAudienceInvalid}
          >
            {saving
              ? editing
                ? "Saving..."
                : "Creating..."
              : editing
                ? "Save Ride request"
                : "Create Ride request"}
          </button>
        </form>
      )}

      {!editing ? (
        <section className="ride-request-preview panel">
          <p className="eyebrow">PUBLIC RIDE REQUESTS</p>
          {loadingRequests ? <p className="muted">Loading recent Ride requests...</p> : null}
          {!loadingRequests && !publicRequests.length ? (
            <p className="muted">No public Ride requests yet.</p>
          ) : null}
          {publicRequests.map((requestItem) => (
            <article className="ride-request-row" key={requestItem.id}>
              <strong>{destinationLabel(requestItem.destination)}</strong>
              <span>
                {requestItem.pickupAreaLabel} - {requestItem.passengerCount} passenger
                {requestItem.passengerCount === 1 ? "" : "s"}
              </span>
              <RideCompensationBadge terms={requestItem.compensationTerms} mode="request" />
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
