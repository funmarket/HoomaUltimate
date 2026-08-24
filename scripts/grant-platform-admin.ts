import { getDatabaseClient, disconnectDatabase } from "@hooma/database";

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
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
    ? await db.user.findUnique({ where: { id: userIdArg }, select: { id: true } })
    : await db.webCredential
        .findUnique({
          where: { loginUsername: loginUsernameArg! },
          select: { user: { select: { id: true } } },
        })
        .then((credential) => credential?.user ?? null);

  if (!user) {
    console.error("Target user was not found.");
    process.exitCode = 1;
  } else {
    await db.$transaction(async (tx) => {
      await tx.platformRoleAssignment.upsert({
        where: { userId_role: { userId: user.id, role: "PLATFORM_ADMIN" } },
        create: { userId: user.id, role: "PLATFORM_ADMIN", grantedBy: "operator-cli" },
        update: { revokedAt: null, grantedAt: new Date(), grantedBy: "operator-cli" },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: "PLATFORM_ADMIN_GRANT",
          entityType: "User",
          entityId: user.id,
          metadata: { source: "operator-cli" },
        },
      });
    });
    console.log(`Granted PLATFORM_ADMIN to ${user.id}.`);
  }
} finally {
  await disconnectDatabase();
}
