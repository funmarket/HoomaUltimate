import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaHelpTaxonomyRepository } from "../apps/api/src/modules/help-taxonomy/infrastructure/prisma-help-taxonomy.repository.js";

const db = getDatabaseClient();

test("Help taxonomy deterministic seed exposes sport-first Requests, Play, Athletes and Donations policy", async () => {
  const repository = new PrismaHelpTaxonomyRepository(db);
  try {
    const requests = await repository.listActiveBySurface("REQUESTS");
    const play = await repository.listActiveBySurface("PLAY");
    const athletes = await repository.listActiveBySurface("ATHLETES");
    const donations = await repository.listActiveBySurface("DONATIONS");

    const requestNeeds = requests.flatMap((subcategory) => subcategory.needs);
    const playNeeds = play.flatMap((subcategory) => subcategory.needs);
    const athleteNeeds = athletes.flatMap((subcategory) => subcategory.needs);
    const donationNeeds = donations.flatMap((subcategory) => subcategory.needs);
    const requestSportSubcategories = requests.filter(
      (subcategory) => subcategory.requestType === "SPORT",
    );
    const footballRoles = requests.find((subcategory) => subcategory.id === "hts-football-roles");

    assert.ok(requestNeeds.some((need) => need.slug === "turf-shoes" && need.kind === "PRODUCT"));
    assert.ok(
      requestNeeds.some((need) => need.slug === "goalkeeper" && need.kind === "COMMUNITY_ROLE"),
    );
    assert.ok(
      requestNeeds.some((need) => need.slug === "pace-partner" && need.kind === "COMMUNITY_ROLE"),
    );
    assert.ok(
      requestSportSubcategories.every((subcategory) =>
        subcategory.needs.some((need) => need.slug === "other" && need.allowsCustomText),
      ),
      "Every SPORT Request taxonomy branch must expose an Other/manual Need",
    );
    for (const slug of [
      "player",
      "assistant-coach",
      "training-session",
      "training-group",
      "training-partner",
    ]) {
      assert.ok(
        footballRoles?.needs.some((need) => need.slug === slug),
        `missing ${slug}`,
      );
    }
    const requestOnlyExpansionIds = new Set([
      "htn-football-player",
      "htn-football-assistant-coach",
      "htn-football-training-session",
      "htn-football-training-group",
      "htn-football-training-partner",
    ]);
    assert.equal(
      [...playNeeds, ...athleteNeeds, ...donationNeeds].some((need) =>
        requestOnlyExpansionIds.has(need.id),
      ),
      false,
      "New sport expansion Needs must not leak into other surfaces without explicit eligibility",
    );
    assert.ok(playNeeds.some((need) => need.slug === "goalkeeper"));
    assert.ok(athleteNeeds.some((need) => need.slug === "pace-partner"));
    assert.ok(donationNeeds.some((need) => need.slug === "turf-shoes"));
    assert.equal(
      donationNeeds.some((need) => need.kind !== "PRODUCT"),
      false,
      "Donations taxonomy must expose PRODUCT needs only",
    );
  } finally {
    await db.$disconnect();
  }
});

test("Help taxonomy database constraints reject duplicate sport/subcategory and need slugs", async () => {
  const suffix = Date.now().toString(36);
  const subcategoryId = `test-sub-${suffix}`;
  try {
    await db.helpTaxonomySubcategory.create({
      data: {
        id: subcategoryId,
        requestType: "SPORT",
        sport: "FOOTBALL",
        slug: `constraint-${suffix}`,
        label: "Constraint Test",
        sortOrder: 999,
      },
    });

    await assert.rejects(
      db.helpTaxonomySubcategory.create({
        data: {
          id: `test-sub-duplicate-${suffix}`,
          requestType: "SPORT",
          sport: "FOOTBALL",
          slug: `constraint-${suffix}`,
          label: "Duplicate",
          sortOrder: 1000,
        },
      }),
    );

    await db.helpTaxonomyNeed.create({
      data: {
        id: `test-need-${suffix}`,
        subcategoryId,
        slug: "same-slug",
        label: "Need",
        kind: "PRODUCT",
        allowsCustomText: false,
        sortOrder: 10,
      },
    });

    await assert.rejects(
      db.helpTaxonomyNeed.create({
        data: {
          id: `test-need-duplicate-${suffix}`,
          subcategoryId,
          slug: "same-slug",
          label: "Duplicate Need",
          kind: "PRODUCT",
          allowsCustomText: false,
          sortOrder: 20,
        },
      }),
    );
  } finally {
    await db.helpTaxonomyNeed.deleteMany({ where: { subcategoryId } });
    await db.helpTaxonomySubcategory.deleteMany({ where: { id: subcategoryId } });
    await db.$disconnect();
  }
});
