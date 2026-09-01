import type { MeResponse } from "@hooma/contracts";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  PublicRideRequest,
  RideRequestAudienceCommand,
  RideRequestCreateInput,
  RideRequestForOwner,
} from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { RideCompensationBadge } from "./RideCompensationBadge";
import {
  RideCompensationFields,
  buildRideRequestCompensationTerms,
  defaultRideCompensationState,
} from "./RideCompensationFields";
import { RideContextSelector, contextQuery, initialRideContext } from "./RideContextSelector";
import { RideDestinationFields } from "./RideDestinationFields";
import { RideSectionHeader } from "./RideSectionHeader";
import {
  dateTimeInputValue,
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

function audienceSuccessMessage(request: RideRequestForOwner): string {
  if (request.audience.scope === "GLOBAL") return "Your Ride request is live in Ride.";
  const count = request.audience.communities.length;
  if (count === 1) {
    return `Your Ride request is live in HOOMA NOW for ${request.audience.communities[0]?.name}.`;
  }
  return `Your Ride request is live in HOOMA NOW for ${count} HOOMAs.`;
}

export function RideRequestCreatePage() {
  const { api: hoomaApi, transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [rideContext, setRideContext] = useState(initialRideContext());
  const [destination, setDestination] = useState(emptyDestination);
  const [pickupAreaLabel, setPickupAreaLabel] = useState("");
  const [desiredDepartureAt, setDesiredDepartureAt] = useState(dateTimeInputValue(90));
  const [expiresAt, setExpiresAt] = useState(dateTimeInputValue(24 * 60));
  const [passengerCount, setPassengerCount] = useState("1");
  const [compensation, setCompensation] = useState(defaultRideCompensationState);
  const [note, setNote] = useState("");
  const [audienceChoice, setAudienceChoice] = useState<RideRequestAudienceChoice>("GLOBAL");
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [memberships, setMemberships] = useState<HoomaMembership[]>([]);
  const [savedRequest, setSavedRequest] = useState<RideRequestForOwner | null>(null);
  const [publicRequests, setPublicRequests] = useState<PublicRideRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingMemberships, setLoadingMemberships] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasCommunityMemberships = memberships.length > 0;
  const communityAudienceInvalid =
    (audienceChoice === "ONE" && !selectedCommunityId) ||
    ((audienceChoice === "ONE" || audienceChoice === "ALL_CURRENT") && !hasCommunityMemberships);

  useEffect(() => {
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
  }, [api, rideContext]);

  useEffect(() => {
    let active = true;
    setLoadingMemberships(true);
    void hoomaApi.identity
      .meOptional()
      .then((me) => {
        if (!active) return;
        const rows = me?.communities ?? [];
        setMemberships(rows);
        setSelectedCommunityId((current) => current || rows[0]?.id || "");
        if (!rows.length) setAudienceChoice("GLOBAL");
      })
      .catch(() => {
        if (!active) return;
        setMemberships([]);
        setSelectedCommunityId("");
        setAudienceChoice("GLOBAL");
      })
      .finally(() => {
        if (active) setLoadingMemberships(false);
      });
    return () => {
      active = false;
    };
  }, [hoomaApi]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (communityAudienceInvalid) {
      setError(communityAudienceCopy);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input: RideRequestCreateInput = {
        context: rideContext,
        destination: destinationInput(destination),
        pickupAreaLabel: pickupAreaLabel.trim(),
        desiredDepartureAt: toIsoDateTime(desiredDepartureAt),
        passengerCount: Number(passengerCount),
        compensationTerms: buildRideRequestCompensationTerms(compensation),
        note: note.trim() || null,
        expiresAt: toIsoDateTime(expiresAt),
        audience: buildRideRequestAudience(audienceChoice, selectedCommunityId),
      };
      setSavedRequest(await api.createRequest(input));
    } catch (reason) {
      setError(protectedError(reason, "Unable to create Ride request"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ride-page ride-form-page">
      <RideSectionHeader
        eyebrow="TAKE ME TO THE GAME"
        title="Request a Ride"
        body="Create a real RideRequest. This does not create fake matching, fare collection, drivers, or bookings."
        actionHref={`/rides/offers${contextQuery(rideContext)}`}
        actionLabel="Browse offers"
      />
      {savedRequest ? (
        <section className="ride-created panel">
          <p className="eyebrow">RIDE REQUEST CREATED</p>
          <h2>{destinationLabel(savedRequest.destination)}</h2>
          <RideCompensationBadge terms={savedRequest.compensationTerms} mode="request" />
          <p>{audienceSuccessMessage(savedRequest)}</p>
          <p>
            One canonical RideRequest is live from {savedRequest.pickupAreaLabel}. Matching remains
            a later Ride-owned capability.
          </p>
          <a
            className="ride-button ride-button--primary"
            href={`/rides${contextQuery(rideContext)}`}
          >
            Back to Ride
          </a>
        </section>
      ) : (
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
              <p>Who should see this Ride request?</p>
            </div>
            <fieldset className="ride-audience-choice" aria-describedby="ride-audience-help">
              <legend>Who should see this Ride request?</legend>
              <label className={audienceChoice === "GLOBAL" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="ride-request-audience"
                  value="GLOBAL"
                  checked={audienceChoice === "GLOBAL"}
                  onChange={() => setAudienceChoice("GLOBAL")}
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
                  onChange={() => setAudienceChoice("ONE")}
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
                  onChange={() => setAudienceChoice("ALL_CURRENT")}
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
                  onChange={(event) => setSelectedCommunityId(event.target.value)}
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
            {saving ? "Creating..." : "Create Ride request"}
          </button>
        </form>
      )}

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
    </section>
  );
}
