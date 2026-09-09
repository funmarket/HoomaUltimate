import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";
import { PrismaAthletesRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";

const db = getDatabaseClient();

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Pause a real transaction after its policy change, before commit. The competing
// service call must acquire the same community lock and observe the committed state.
async function afterLockedChange<T>(
  repository: PrismaAthletesRepository,
  id: string,
  change: (service: AthletesService) => Promise<unknown>,
  competing: () => Promise<T>,
): Promise<T> {
  const changed = deferred();
  const release = deferred();
  const transaction = repository.withCommunityLock(id, async (scoped) => {
    await change(new AthletesService(scoped));
    changed.resolve();
    await release.promise;
  });
  // Propagate setup failures without leaving an unresolved test gate.
  void transaction.catch(changed.resolve);
  await changed.promise;
  const outcome = competing();
  void outcome.catch(() => undefined);
  try {
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const rows = await db.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query LIKE '%AthletesCommunity%FOR UPDATE%'
      `;
      if (Number(rows[0]?.count) > 0) {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(waiting, true, "competing operation must wait for the community transaction");
  } finally {
    release.resolve();
    await transaction;
  }
  return outcome;
}

test("Athletes lifecycle serializes policy changes and competing membership writes", async () => {
  const repository = new PrismaAthletesRepository(db);
  const service = new AthletesService(repository);
  const users = await Promise.all(Array.from({ length: 4 }, () => db.user.create({ data: {} })));
  const [founder, moderator, target, applicant] = users.map((user) => user.id);
  assert.ok(founder && moderator && target && applicant);
  const ids: string[] = [];
  try {
    const community = await service.create(founder, {
      name: `Concurrent Athletes ${Date.now()}`,
      sport: "RUNNING",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
    });
    ids.push(community.id);
    await service.join(moderator, community.id);
    await service.join(target, community.id);
    await service.setRole(founder, community.id, moderator, "MODERATOR");

    await assert.rejects(
      afterLockedChange(
        repository,
        community.id,
        (scoped) => scoped.setRole(founder, community.id, target, "MODERATOR"),
        () => service.removeMember(moderator, community.id, target),
      ),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_MODERATOR_SCOPE",
    );
    assert.equal(await repository.activeRole(community.id, target), "MODERATOR");

    const joined = await afterLockedChange(
      repository,
      community.id,
      (scoped) => scoped.update(founder, community.id, { visibility: "PRIVATE" }),
      () => service.join(applicant, community.id),
    );
    assert.equal(joined.status, "PENDING");
    assert.equal(await repository.activeRole(community.id, applicant), null);

    await assert.rejects(
      afterLockedChange(
        repository,
        community.id,
        (scoped) => scoped.removeMember(founder, community.id, moderator),
        () => service.approveJoinRequest(moderator, community.id, applicant),
      ),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_MANAGER_REQUIRED",
    );
    assert.equal((await repository.getJoinRequest(community.id, applicant))?.status, "PENDING");

    await assert.rejects(
      repository.withCommunityLock(community.id, async (scoped) => {
        await new AthletesService(scoped).approveJoinRequest(founder, community.id, applicant);
        throw new Error("rollback probe");
      }),
      /rollback probe/,
    );
    assert.equal(await repository.activeRole(community.id, applicant), null);
    assert.equal((await repository.getJoinRequest(community.id, applicant))?.status, "PENDING");

    await assert.rejects(
      afterLockedChange(
        repository,
        community.id,
        (scoped) => scoped.archive(founder, community.id),
        () => service.approveJoinRequest(founder, community.id, applicant),
      ),
      (error: unknown) => error instanceof AthletesError && error.code === "ATHLETES_NOT_FOUND",
    );
    assert.equal(await repository.activeRole(community.id, applicant), null);
    await assert.rejects(() => service.join(applicant, community.id), /not found/);
  } finally {
    await db.athletesCommunity.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await db.$disconnect();
  }
});
