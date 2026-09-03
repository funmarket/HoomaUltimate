import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const beforeMigrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE migration_name IN (
      '20260903160000_event_attendance_lifecycle',
      '20260903170000_restore_event_checkin_semantics'
    )
    ORDER BY migration_name
  `);

  const beforeLegacy = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count
    FROM "EventCheckIn"
    WHERE "id" LIKE 'legacy-checkin-%'
  `);

  const deletedLegacy = await prisma.$executeRawUnsafe(`
    DELETE FROM "EventCheckIn"
    WHERE "id" LIKE 'legacy-checkin-%'
  `);

  const deletedMigrations = await prisma.$executeRawUnsafe(`
    DELETE FROM "_prisma_migrations"
    WHERE migration_name IN (
      '20260903160000_event_attendance_lifecycle',
      '20260903170000_restore_event_checkin_semantics'
    )
  `);

  const afterMigrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE migration_name IN (
      '20260903160000_event_attendance_lifecycle',
      '20260903170000_restore_event_checkin_semantics'
    )
  `);

  const afterLegacy = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count
    FROM "EventCheckIn"
    WHERE "id" LIKE 'legacy-checkin-%'
  `);

  const schema = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='EventRsvp' AND column_name='checkedInAt') AS checked_in_at,
      (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='EventCheckIn' AND column_name='eventId') AS event_id,
      (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='EventCheckIn' AND column_name='userId') AS user_id
  `);

  const result = {
    beforeMigrations,
    beforeLegacy,
    deletedLegacy,
    deletedMigrations,
    afterMigrations,
    afterLegacy,
    schema,
  };

  console.log('EVENT_MIGRATION_RESIDUE_CLEANUP_RESULT=' + JSON.stringify(result));

  if (
    afterMigrations.length !== 0 ||
    afterLegacy[0]?.count !== 0 ||
    schema[0]?.checked_in_at !== 1 ||
    schema[0]?.event_id !== 1 ||
    schema[0]?.user_id !== 1
  ) {
    throw new Error('Targeted Event migration residue cleanup verification failed');
  }
} finally {
  await prisma.$disconnect();
}
