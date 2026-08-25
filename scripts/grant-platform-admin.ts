import { getDatabaseClient, disconnectDatabase } from "@hooma/database";

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const configuredTelegramUserId = process.env.PLATFORM_ADMIN_BOOTSTRAP_TELEGRAM_USER_ID?.trim();
if (!configuredTelegramUserId || !/^\d+$/.test(configuredTelegramUserId)) {
  console.error(
    "PLATFORM_ADMIN_BOOTSTRAP_TELEGRAM_USER_ID must identify the configured platform owner.",
  );
  process.exit(2);
}

const userIdArg = argument("user-id");
const loginUsernameArg = argument("login-username")?.trim().toLowerCase();

if (Boolean(userIdArg) === Boolean(loginUsernameArg)) {
  console.error("Provide exactly one of --user-id=<id> or --login-username=<username>.");
  process.exit(2);
}

const db = getDatabaseClient();
try {
  const user = userIdArg
    ? await db.user.findUnique({
        where: { id: userIdArg },
        select: { id: true, telegramIdentity: { select: { telegramUserId: true } } },
      })
    : await db.webCredential
        .findUnique({
          where: { loginUsername: loginUsernameArg! },
          select: {
            user: {
              select: { id: true, telegramIdentity: { select: { telegramUserId: true } } },
            },
          },
        })
        .then((credential) => credential?.user ?? null);

  if (!user) {
    console.error("Target user was not found.");
    process.exitCode = 1;
  } else if (user.telegramIdentity?.telegramUserId.toString() !== configuredTelegramUserId) {
    console.error(
      "Refusing full PLATFORM_ADMIN grant: target is not the configured platform owner. Use App Manager capabilities for delegated access.",
    );
    process.exitCode = 1;
  } else {
    await db.$transaction(async (tx) => {
      await tx.platformRoleAssignment.updateMany({
        where: { role: "PLATFORM_ADMIN", revokedAt: null, userId: { not: user.id } },
        data: { revokedAt: new Date() },
      });
      await tx.platformRoleAssignment.upsert({
        where: { userId_role: { userId: user.id, role: "PLATFORM_ADMIN" } },
        create: { userId: user.id, role: "PLATFORM_ADMIN", grantedBy: "configured-owner-cli" },
        update: {
          revokedAt: null,
          grantedAt: new Date(),
          grantedBy: "configured-owner-cli",
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: "PLATFORM_OWNER_RECONCILED",
          entityType: "User",
          entityId: user.id,
          metadata: { source: "configured-owner-cli" },
        },
      });
    });
    console.log(`Reconciled configured platform owner ${user.id}.`);
  }
} finally {
  await disconnectDatabase();
}
