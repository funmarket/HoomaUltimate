import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { getDatabaseClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import { CommunityIdentityMediaService } from "../apps/api/src/modules/communities/application/community-identity-media.service.js";
import { CommunityIdentityImageProcessor } from "../apps/api/src/modules/communities/infrastructure/community-identity-image-processor.js";
import { PrismaCommunityRepository } from "../apps/api/src/modules/communities/infrastructure/prisma-community.repository.js";

const db = getDatabaseClient();
const png = new Uint8Array(
  await sharp({ create: { width: 24, height: 24, channels: 3, background: "#ffffff" } })
    .png()
    .toBuffer(),
);

for (const visibility of ["PUBLIC", "PRIVATE"] as const) {
  for (const status of ["ACTIVE", "ARCHIVED"] as const) {
    test(`${visibility} ${status} Community upload respects creator, real Admin role, Coach/Member/outsider`, async () => {
      const [creator, admin, coach, member, outsider] = await Promise.all(
        Array.from({ length: 5 }, () => db.user.create({ data: {} })),
      );
      const community = await db.community.create({
        data: {
          slug: `step24-auth-${randomUUID()}`,
          name: "Step 24 Community authorization",
          visibility,
          status: "ACTIVE",
          createdByUserId: creator.id,
          joinPolicy: visibility === "PRIVATE" ? "APPROVAL_REQUIRED" : "OPEN",
        },
      });
      try {
        await db.communityMembership.createMany({
          data: [
            { communityId: community.id, userId: creator.id, role: "FOUNDER" },
            { communityId: community.id, userId: coach.id, role: "COACH" },
            { communityId: community.id, userId: member.id, role: "MEMBER" },
          ],
        });
        const adminRole = await db.platformRoleAssignment.create({
          data: { userId: admin.id, role: "PLATFORM_ADMIN" },
        });
        const roleLookup = {
          isPlatformAdmin: async (userId: string) =>
            Boolean(
              await db.platformRoleAssignment.findFirst({
                where: { userId, role: "PLATFORM_ADMIN", revokedAt: null },
              }),
            ),
        };
        const repository = new PrismaCommunityRepository(db);
        const communities = new CommunityService(repository, roleLookup);
        if (status === "ARCHIVED") {
          await communities.archive(creator.id, community.id);
          assert.equal(
            await db.communityMembership.count({
              where: { communityId: community.id, leftAt: null },
            }),
            0,
          );
        }
        let storedCount = 0;
        const storage = {
          put: async (key: string, body: Uint8Array, contentType: string) => {
            storedCount++;
            return { key, contentType, sizeBytes: body.byteLength };
          },
          remove: async () => {
            throw Error("Worker-only cleanup");
          },
        } as unknown as ObjectStorage;
        const media = new CommunityIdentityMediaService(
          communities,
          repository,
          storage,
          "staging",
          new CommunityIdentityImageProcessor(),
        );
        for (const denied of [coach, member, outsider]) {
          await assert.rejects(
            media.upload(denied.id, community.id, "logo", { body: png, contentType: "image/png" }),
            (error: { code?: string }) => error?.code === "COMMUNITY_OWNER_OR_ADMIN_REQUIRED",
          );
        }
        assert.equal(storedCount, 0);
        assert.equal(await db.outboxEvent.count({ where: { aggregateId: community.id } }), 0);

        await media.upload(creator.id, community.id, "logo", {
          body: png,
          contentType: "image/png",
        });
        await media.upload(admin.id, community.id, "banner", {
          body: png,
          contentType: "image/png",
        });
        assert.equal(storedCount, 2);
        const record = await db.community.findUniqueOrThrow({ where: { id: community.id } });
        assert.ok(record.logoMediaId);
        assert.ok(record.bannerMediaId);
        assert.equal(
          await communities.canViewPrivateContent(community.id, outsider.id),
          status === "ACTIVE" && visibility === "PUBLIC",
        );
        assert.equal(
          await communities.canViewPrivateContent(community.id, creator.id),
          status === "ACTIVE",
        );
        const listed = (await communities.listPublic()).items as Array<{ id: string }>;
        assert.equal(
          listed.some(({ id }) => id === community.id),
          status === "ACTIVE",
        );
        if (status === "ARCHIVED") {
          await assert.rejects(communities.getPublic(community.id));
        }
        await db.platformRoleAssignment.update({
          where: { id: adminRole.id },
          data: { revokedAt: new Date() },
        });
        await assert.rejects(
          media.upload(admin.id, community.id, "banner", { body: png, contentType: "image/png" }),
          (error: { code?: string }) => error?.code === "COMMUNITY_OWNER_OR_ADMIN_REQUIRED",
        );
        assert.equal(storedCount, 2);
      } finally {
        await db.outboxEvent.deleteMany({ where: { aggregateId: community.id } });
        await db.community.delete({ where: { id: community.id } });
        for (const user of [creator, admin, coach, member, outsider]) {
          await db.user.delete({ where: { id: user.id } });
        }
      }
    });
  }
}
