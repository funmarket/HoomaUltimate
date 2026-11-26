import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";

const db = getDatabaseClient();

test("Community identity schema preserves legacy URLs and enforces exclusive managed slots", async () => {
  const user = await db.user.create({ data: {} });
  const community = await db.community.create({
    data: {
      slug: `step24-legacy-${randomUUID()}`,
      name: "Step 24 legacy URL compatibility",
      createdByUserId: user.id,
      logoUrl: "https://images.example.org/original-logo.png",
      bannerUrl: "https://images.example.org/original-banner.png",
    },
  });

  try {
    const initial = await db.$queryRaw<
      Array<{
        logoUrl: string | null;
        bannerUrl: string | null;
        logoMediaId: string | null;
        bannerMediaId: string | null;
      }>
    >`
      SELECT "logoUrl", "bannerUrl", "logoMediaId", "bannerMediaId"
      FROM "Community" WHERE "id" = ${community.id}
    `;
    assert.equal(initial[0]?.logoUrl, "https://images.example.org/original-logo.png");
    assert.equal(initial[0]?.bannerUrl, "https://images.example.org/original-banner.png");
    assert.equal(initial[0]?.logoMediaId, null);
    assert.equal(initial[0]?.bannerMediaId, null);

    const logoId = randomUUID();
    const logoKey = `staging/media/v1/community-logo/${community.id}/${logoId}/master.webp`;
    await db.$executeRaw`
      UPDATE "Community"
      SET "logoUrl" = NULL,
          "logoMediaId" = ${logoId},
          "logoObjectKey" = ${logoKey},
          "logoContentType" = 'image/webp',
          "logoSizeBytes" = 3
      WHERE "id" = ${community.id}
    `;
    await assert.rejects(
      db.$executeRaw`
        UPDATE "Community" SET "logoUrl" = 'https://images.example.org/competing.png'
        WHERE "id" = ${community.id}
      `,
    );

    const bannerId = randomUUID();
    const bannerKey = `staging/media/v1/community-banner/${community.id}/${bannerId}/master.webp`;
    await db.$executeRaw`
      UPDATE "Community"
      SET "bannerUrl" = NULL,
          "bannerMediaId" = ${bannerId},
          "bannerObjectKey" = ${bannerKey},
          "bannerContentType" = 'image/webp',
          "bannerSizeBytes" = 3
      WHERE "id" = ${community.id}
    `;
    const managed = await db.$queryRaw<
      Array<{ logoMediaId: string | null; bannerMediaId: string | null }>
    >`
      SELECT "logoMediaId", "bannerMediaId" FROM "Community" WHERE "id" = ${community.id}
    `;
    assert.equal(managed[0]?.logoMediaId, logoId);
    assert.equal(managed[0]?.bannerMediaId, bannerId);

    await assert.rejects(
      db.$executeRaw`
        UPDATE "Community" SET "bannerSizeBytes" = NULL WHERE "id" = ${community.id}
      `,
    );
    await db.$executeRaw`
      UPDATE "Community"
      SET "logoMediaId" = NULL, "logoObjectKey" = NULL,
          "logoContentType" = NULL, "logoSizeBytes" = NULL
      WHERE "id" = ${community.id}
    `;
    const remaining = await db.$queryRaw<
      Array<{ logoMediaId: string | null; bannerMediaId: string | null }>
    >`
      SELECT "logoMediaId", "bannerMediaId" FROM "Community" WHERE "id" = ${community.id}
    `;
    assert.equal(remaining[0]?.logoMediaId, null);
    assert.equal(remaining[0]?.bannerMediaId, bannerId);
  } finally {
    await db.community.delete({ where: { id: community.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
