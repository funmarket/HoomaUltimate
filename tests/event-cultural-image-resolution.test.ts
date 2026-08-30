import assert from "node:assert/strict";
import test from "node:test";
import type { EventCreateInput, EventUpdateInput } from "@hooma/contracts";
import { EventService } from "../apps/api/src/modules/events/application/event.service.js";
import type { EventImageResolver } from "../apps/api/src/modules/events/application/event-image-resolver.js";
import type { EventRepository } from "../apps/api/src/modules/events/application/event.repository.js";
import type { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import type { PlaceService } from "../apps/api/src/modules/places/application/place.service.js";

type Captured = { create?: EventCreateInput; update?: EventUpdateInput };

function createHarness() {
  const captured: Captured = {};
  const repository = {
    create: async (_userId: string, input: EventCreateInput) => {
      captured.create = input;
      return { ok: true };
    },
    access: async () => ({
      communityId: null,
      placeId: "place-1",
      type: "WATCH",
      createdByUserId: "owner-1",
      status: "PUBLISHED",
      entryFeeMinor: 0n,
      watchKind: "CULTURAL",
    }),
    update: async (_eventId: string, input: EventUpdateInput) => {
      captured.update = input;
      return { ok: true };
    },
  } as unknown as EventRepository;

  const communities = {} as CommunityService;
  const places = {
    getPublic: async () => ({ id: "place-1" }),
    isVerifiedOwner: async () => true,
  } as unknown as PlaceService;

  const resolvedInputs: string[] = [];
  const imageResolver: EventImageResolver = {
    resolve: async (value) => {
      resolvedInputs.push(value);
      return "https://cdn.example.com/full-image.jpg";
    },
  };

  return {
    service: new EventService(repository, communities, places, imageResolver),
    captured,
    resolvedInputs,
  };
}

function culturalCreate(imageUrl: string | null): EventCreateInput {
  return {
    communityId: null,
    placeId: "place-1",
    type: "WATCH",
    title: "Live at Cafe Thirteen",
    description: null,
    startsAt: "2026-09-05T19:00:00.000Z",
    endsAt: null,
    timezone: "Africa/Tunis",
    venueName: null,
    address: null,
    capacity: null,
    waitlistEnabled: true,
    entryFeeMinor: 0,
    currency: "TND",
    play: null,
    watch: {
      kind: "CULTURAL",
      culturalCategory: "MUSIC",
      imageUrl,
    },
  };
}

test("cultural Watch create resolves a public page URL before repository persistence", async () => {
  const harness = createHarness();
  const inputUrl = "https://example.com/very/long/share/page?image=result";

  await harness.service.create("owner-1", culturalCreate(inputUrl));

  assert.deepEqual(harness.resolvedInputs, [inputUrl]);
  assert.equal(
    harness.captured.create?.watch?.kind === "CULTURAL"
      ? harness.captured.create.watch.imageUrl
      : null,
    "https://cdn.example.com/full-image.jpg",
  );
});

test("cultural Watch update resolves artwork before repository persistence", async () => {
  const harness = createHarness();
  const inputUrl = "https://example.com/share/cultural-event";

  await harness.service.update("owner-1", "event-1", {
    watch: {
      kind: "CULTURAL",
      culturalCategory: "ART",
      imageUrl: inputUrl,
    },
  });

  assert.deepEqual(harness.resolvedInputs, [inputUrl]);
  assert.equal(
    harness.captured.update?.watch?.kind === "CULTURAL"
      ? harness.captured.update.watch.imageUrl
      : null,
    "https://cdn.example.com/full-image.jpg",
  );
});

test("cultural Watch without event artwork keeps Place fallback and does not invoke resolver", async () => {
  const harness = createHarness();

  await harness.service.create("owner-1", culturalCreate(null));

  assert.deepEqual(harness.resolvedInputs, []);
  assert.equal(
    harness.captured.create?.watch?.kind === "CULTURAL"
      ? harness.captured.create.watch.imageUrl
      : undefined,
    null,
  );
});

test("match Watch artwork fields are not sent through the cultural resolver", async () => {
  const harness = createHarness();
  const input: EventCreateInput = {
    ...culturalCreate(null),
    title: "Stade vs Mistir",
    watch: {
      kind: "MATCH",
      teamOneName: "Stade",
      teamOneLogoUrl: "https://example.com/stade.png",
      teamTwoName: "Mistir",
      teamTwoLogoUrl: "https://example.com/mistir.png",
    },
  };

  await harness.service.create("owner-1", input);

  assert.deepEqual(harness.resolvedInputs, []);
  assert.equal(harness.captured.create?.watch?.kind, "MATCH");
});
