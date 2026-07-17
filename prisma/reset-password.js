// Resets the admin password to the current value of ADMIN_PASSWORD.
// Usage: ADMIN_PASSWORD=newpass pnpm run reset-password
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error("[reset-password] ADMIN_PASSWORD is not set.");
    process.exitCode = 1;
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.findFirst();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    console.log("[reset-password] Admin password updated.");
  } else {
    await prisma.user.create({ data: { passwordHash } });
    console.log("[reset-password] No admin existed - created one.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
