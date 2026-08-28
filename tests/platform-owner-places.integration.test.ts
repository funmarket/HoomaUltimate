import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for platform owner integration tests");

const suffix = Date.now().toString(36);
const ownerTelegramId = BigInt(`9${Date.now()}${Math.floor(Math.random() * 1000)}`);
const canonicalPlaceCover = "https://images.example.com/venue/photo?id=123&size=large";
const staleLegacyCover = "https://images.example.com/legacy-stale-cover";
const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
  PLATFORM_ADMIN_BOOTSTRAP_TELEGRAM_USER_ID: ownerTelegramId.toString(),
});
const db = getDatabaseClient();

async function register(base: string, username: string) {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: username,
      password: "correct horse battery staple",
      displayUsername: username,
      displayName: username,
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  const credential = await db.webCredential.findUniqueOrThrow({
    where: { loginUsername: username },
  });
  return { cookie, userId: credential.userId };
}

function headers(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

test("App Admin approves a Place once while its owner manages Place and Watch Event lifecycle", async () => {
  const container = createContainer(config);
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const owner = await register(base, `owner_${suffix}`);
    const manager = await register(base, `manager_${suffix}`);
    const business = await register(base, `business_${suffix}`);
    const claimant = await register(base, `claimant_${suffix}`);

    await db.telegramIdentity.create({
      data: { userId: owner.userId, telegramUserId: ownerTelegramId },
    });
    await db.platformRoleAssignment.create({
      data: { userId: manager.userId, role: "PLATFORM_ADMIN", grantedBy: "rogue-test" },
    });

    assert.deepEqual(
      await container.platformAdminService.bootstrapConfiguredOwner(ownerTelegramId.toString()),
      { status: "ready" },
    );
    assert.equal(
      await db.platformRoleAssignment.count({ where: { role: "PLATFORM_ADMIN", revokedAt: null } }),
      1,
    );
    assert.equal(
      await db.platformRoleAssignment.count({
        where: { userId: owner.userId, role: "PLATFORM_ADMIN", revokedAt: null },
      }),
      1,
    );
    assert.equal(
      await db.platformRoleAssignment.count({
        where: { userId: manager.userId, role: "PLATFORM_ADMIN", revokedAt: null },
      }),
      0,
    );

    const managerGrant = await fetch(`${base}/api/v1/admin/managers/manager_${suffix}`, {
      method: "PUT",
      headers: headers(owner.cookie),
      body: JSON.stringify({ capabilities: ["REVIEW_PITCH_APPLICATIONS", "VIEW_AUDIT"] }),
    });
    assert.equal(managerGrant.status, 200);

    const managerAccess = await fetch(`${base}/api/v1/admin/access`, {
      headers: headers(manager.cookie),
    });
    assert.equal(managerAccess.status, 200);
    assert.deepEqual(await managerAccess.json(), {
      isPlatformOwner: false,
      managerCapabilities: ["REVIEW_PITCH_APPLICATIONS", "VIEW_AUDIT"],
    });

    const forbiddenDelegation = await fetch(`${base}/api/v1/admin/managers/business_${suffix}`, {
      method: "PUT",
      headers: headers(manager.cookie),
      body: JSON.stringify({ capabilities: ["REVIEW_PITCH_APPLICATIONS"] }),
    });
    assert.equal(forbiddenDelegation.status, 403);

    const placeResponse = await fetch(`${base}/api/v1/places`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({
        name: `Owner Venue ${suffix}`,
        category: "Sports café",
        description: "Match-night venue with large screens",
        imageUrl: canonicalPlaceCover,
        address: "1 Football Street",
        city: "Tunis",
        houma: "Centre",
        latitude: null,
        longitude: null,
        phone: "+21671000000",
        email: "venue@example.com",
        websiteUrl: "https://venue.example.com",
        menuItems: [
          { name: "Espresso", price: 4, currency: "TND" },
          { name: "Pizza", price: 18, currency: "TND" },
        ],
      }),
    });
    assert.equal(placeResponse.status, 201);
    const place = (await placeResponse.json()) as { id: string; status: string };
    assert.equal(place.status, "PENDING");

    const pendingManage = await fetch(`${base}/api/v1/places/${place.id}/manage`, {
      headers: headers(business.cookie),
    });
    assert.equal(pendingManage.status, 200);

    const beforeApproval = await fetch(`${base}/api/public/v1/places`);
    assert.equal(beforeApproval.status, 200);
    assert.equal(
      ((await beforeApproval.json()) as { id: string }[]).some((item) => item.id === place.id),
      false,
    );

    await db.place.update({
      where: { id: place.id },
      data: { imageUrl: staleLegacyCover },
    });
    const pendingPlacesResponse = await fetch(`${base}/api/v1/admin/queues/places`, {
      headers: headers(owner.cookie),
    });
    assert.equal(pendingPlacesResponse.status, 200);
    const pendingPlaces = (await pendingPlacesResponse.json()) as {
      id: string;
      place: { id: string; imageUrl: string | null };
    }[];
    const pendingPlace = pendingPlaces.find((item) => item.id === place.id);
    assert.ok(pendingPlace);
    assert.equal(
      pendingPlace.place.imageUrl,
      canonicalPlaceCover,
      "Pending Place queue must read its cover from canonical PlaceImage rows",
    );

    const managerPlaceDecision = await fetch(
      `${base}/api/v1/admin/queues/places/${place.id}/decision`,
      {
        method: "POST",
        headers: headers(manager.cookie),
        body: JSON.stringify({ decision: "APPROVE" }),
      },
    );
    assert.equal(managerPlaceDecision.status, 403);

    const placeDecision = await fetch(`${base}/api/v1/admin/queues/places/${place.id}/decision`, {
      method: "POST",
      headers: headers(owner.cookie),
      body: JSON.stringify({ decision: "APPROVE", note: "Approved by App Admin" }),
    });
    assert.equal(placeDecision.status, 200);

    assert.equal(
      await db.placeOwnership.findFirst({
        where: { placeId: place.id, userId: business.userId, revokedAt: null },
      }),
      null,
      "Place approval must not grant ownership; ownership verification is a separate Admin decision",
    );

    const ownershipClaimResponse = await fetch(
      `${base}/api/v1/places/${place.id}/ownership-claims`,
      {
        method: "POST",
        headers: headers(claimant.cookie),
        body: JSON.stringify({ evidence: "Claimant has venue ownership documents" }),
      },
    );
    assert.equal(ownershipClaimResponse.status, 201);
    const ownershipClaim = (await ownershipClaimResponse.json()) as { id: string; status: string };
    assert.equal(ownershipClaim.status, "PENDING");

    const ownershipQueueResponse = await fetch(`${base}/api/v1/admin/queues/place-ownership`, {
      headers: headers(owner.cookie),
    });
    assert.equal(ownershipQueueResponse.status, 200);
    const ownershipQueue = (await ownershipQueueResponse.json()) as {
      id: string;
      place: { id: string; imageUrl: string | null };
    }[];
    const queuedOwnershipClaim = ownershipQueue.find((item) => item.id === ownershipClaim.id);
    assert.ok(queuedOwnershipClaim);
    assert.equal(queuedOwnershipClaim.place.id, place.id);
    assert.equal(
      queuedOwnershipClaim.place.imageUrl,
      canonicalPlaceCover,
      "Ownership claim queue must read its Place cover from canonical PlaceImage rows",
    );

    const updatePlace = await fetch(`${base}/api/v1/places/${place.id}`, {
      method: "PATCH",
      headers: headers(business.cookie),
      body: JSON.stringify({
        description: "Updated match-night venue",
        menuItems: [
          { name: "Espresso", price: 4, currency: "TND" },
          { name: "Mint Tea", price: 4, currency: "TND" },
          { name: "Pizza", price: 18, currency: "TND" },
        ],
      }),
    });
    assert.equal(updatePlace.status, 200);

    const publicPlace = await fetch(`${base}/api/public/v1/places/${place.id}`);
    assert.equal(publicPlace.status, 200);
    const approvedPlace = (await publicPlace.json()) as {
      id: string;
      imageUrl: string | null;
      category: string | null;
      description: string | null;
      latitude: number | null;
      longitude: number | null;
      menuItems: { name: string; price: number; currency: string }[];
    };
    assert.equal(approvedPlace.id, place.id);
    assert.equal(approvedPlace.imageUrl, canonicalPlaceCover);
    assert.equal(approvedPlace.category, "Sports café");
    assert.equal(approvedPlace.description, "Updated match-night venue");
    assert.equal(approvedPlace.latitude, null);
    assert.equal(approvedPlace.longitude, null);
    assert.deepEqual(
      approvedPlace.menuItems.map(({ name, price, currency }) => ({ name, price, currency })),
      [
        { name: "Espresso", price: 4, currency: "TND" },
        { name: "Mint Tea", price: 4, currency: "TND" },
        { name: "Pizza", price: 18, currency: "TND" },
      ],
    );

    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const watchResponse = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({
        communityId: null,
        placeId: place.id,
        type: "WATCH",
        title: "Esperance vs Club Africain",
        startsAt,
        timezone: "Africa/Tunis",
        waitlistEnabled: true,
        entryFeeMinor: 0,
        currency: "TND",
        play: null,
        watch: {
          teamOneName: "Esperance",
          teamOneLogoUrl: "https://images.example.com/esperance",
          teamTwoName: "Club Africain",
          teamTwoLogoUrl: "https://images.example.com/club-africain?size=512",
        },
      }),
    });
    assert.equal(watchResponse.status, 201);
    const watchEvent = (await watchResponse.json()) as {
      id: string;
      title: string;
      placeId: string;
      venueAuthority: string;
      watchDetails: {
        teamOneName: string;
        teamOneLogoUrl: string | null;
        teamTwoName: string;
        teamTwoLogoUrl: string | null;
      };
    };
    assert.equal(watchEvent.title, "Esperance vs Club Africain");
    assert.equal(watchEvent.placeId, place.id);
    assert.equal(watchEvent.venueAuthority, "OFFICIAL_VENUE");
    assert.equal(watchEvent.watchDetails.teamOneName, "Esperance");
    assert.equal(
      watchEvent.watchDetails.teamTwoLogoUrl,
      "https://images.example.com/club-africain?size=512",
    );

    const editWatch = await fetch(`${base}/api/v1/events/${watchEvent.id}`, {
      method: "PATCH",
      headers: headers(business.cookie),
      body: JSON.stringify({
        watch: {
          teamOneName: "Esperance",
          teamOneLogoUrl: "https://images.example.com/esperance-updated",
          teamTwoName: "Etoile du Sahel",
          teamTwoLogoUrl: "https://images.example.com/etoile",
        },
      }),
    });
    assert.equal(editWatch.status, 200);
    const editedWatch = (await editWatch.json()) as {
      title: string;
      watchDetails: { teamTwoName: string; teamOneLogoUrl: string | null };
    };
    assert.equal(editedWatch.title, "Esperance vs Etoile du Sahel");
    assert.equal(editedWatch.watchDetails.teamTwoName, "Etoile du Sahel");
    assert.equal(
      editedWatch.watchDetails.teamOneLogoUrl,
      "https://images.example.com/esperance-updated",
    );

    const canonicalPlace = (await (
      await fetch(`${base}/api/public/v1/places/${place.id}`)
    ).json()) as { imageUrl: string | null };
    assert.equal(
      canonicalPlace.imageUrl,
      canonicalPlaceCover,
      "PlaceImage must remain the canonical cover when the legacy Place.imageUrl diverges",
    );

    const publicWatch = await fetch(`${base}/api/public/v1/events?type=WATCH&limit=50`);
    assert.equal(publicWatch.status, 200);
    const watchPage = (await publicWatch.json()) as {
      items: {
        id: string;
        placeId: string;
        venueAuthority: string;
        place: { imageUrl: string | null } | null;
      }[];
    };
    const publishedWatch = watchPage.items.find((item) => item.id === watchEvent.id);
    assert.ok(publishedWatch);
    assert.equal(publishedWatch.placeId, place.id);
    assert.equal(publishedWatch.venueAuthority, "OFFICIAL_VENUE");
    assert.equal(
      publishedWatch.place?.imageUrl,
      canonicalPlaceCover,
      "Watch Event serialization must use the canonical PlaceImage cover",
    );

    const removedWatchApplication = await fetch(`${base}/api/v1/watch/applications`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({
        placeId: place.id,
        summary: "obsolete Watch capability application",
        contactName: "Venue Manager",
      }),
    });
    assert.equal(removedWatchApplication.status, 404);

    const pitchResponse = await fetch(`${base}/api/v1/pitch/applications`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({
        placeId: place.id,
        summary: "Bookable football pitch with changing rooms and floodlights",
        hourlyRateMinor: 12_000,
        currency: "TND",
        contactName: "Venue Manager",
      }),
    });
    assert.equal(pitchResponse.status, 201);
    const pitchApplication = (await pitchResponse.json()) as { id: string };

    const managerPitchDecision = await fetch(
      `${base}/api/v1/admin/queues/pitch/${pitchApplication.id}/decision`,
      {
        method: "POST",
        headers: headers(manager.cookie),
        body: JSON.stringify({ decision: "APPROVE" }),
      },
    );
    assert.equal(managerPitchDecision.status, 200);

    const deleteEvent = await fetch(`${base}/api/v1/events/${watchEvent.id}/cancel`, {
      method: "POST",
      headers: headers(business.cookie),
    });
    assert.equal(deleteEvent.status, 200);
    assert.equal(
      (await db.event.findUniqueOrThrow({ where: { id: watchEvent.id } })).status,
      "CANCELLED",
    );
    const afterEventDelete = (await (
      await fetch(`${base}/api/public/v1/events?type=WATCH&limit=50`)
    ).json()) as { items: { id: string }[] };
    assert.equal(
      afterEventDelete.items.some((item) => item.id === watchEvent.id),
      false,
    );

    const deletePlace = await fetch(`${base}/api/v1/places/${place.id}`, {
      method: "DELETE",
      headers: headers(business.cookie),
    });
    assert.equal(deletePlace.status, 200);
    assert.ok((await db.place.findUniqueOrThrow({ where: { id: place.id } })).archivedAt);
    assert.equal((await fetch(`${base}/api/public/v1/places/${place.id}`)).status, 404);

    assert.ok(
      await db.auditLog.findFirst({
        where: { action: "PLACE_APPROVED", entityId: place.id },
      }),
    );
    assert.ok(
      await db.auditLog.findFirst({
        where: { action: "PITCH_APPLICATION_APPROVED", entityId: pitchApplication.id },
      }),
    );
  } finally {
    await db.eventChatMessage.deleteMany();
    await db.eventChatRoom.deleteMany();
    await db.eventRsvp.deleteMany();
    await db.event.deleteMany();
    await db.placeCapabilityApplication.deleteMany();
    await db.placeOwnership.deleteMany();
    await db.placeOwnershipClaim.deleteMany();
    await db.place.deleteMany();
    await db.appManagerGrant.deleteMany();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});