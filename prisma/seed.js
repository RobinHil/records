// Idempotent seed: creates the single admin user on first launch.
// The initial password comes from ADMIN_PASSWORD; it can be changed later by
// re-running this script with a new ADMIN_PASSWORD after deleting the user row,
// or via `pnpm run reset-password`.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findFirst();
  if (existing) {
    console.log("[seed] Admin user already exists, nothing to do.");
    return;
  }
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.warn(
      "[seed] ADMIN_PASSWORD is not set - skipping admin creation. " +
        "Set it in .env and re-run the seed to be able to log in."
    );
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { passwordHash } });
  console.log("[seed] Admin user created from ADMIN_PASSWORD.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
