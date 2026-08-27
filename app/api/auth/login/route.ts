import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";
import { clientIp, hit, reset } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";

// 10 tentatives par IP et par quart d'heure, et 100 au total sur la même
// fenêtre : la seconde borne tient même si l'attaquant falsifie X-Forwarded-For.
const PER_IP_LIMIT = 10;
const GLOBAL_LIMIT = 100;
const WINDOW_MS = 15 * 60 * 1000;

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Trop de tentatives. Réessayez plus tard." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function POST(request: Request) {
  const ip = clientIp(request);

  const perIp = hit(`login:${ip}`, PER_IP_LIMIT, WINDOW_MS);
  if (!perIp.allowed) return tooMany(perIp.retryAfterSeconds);

  const global = hit("login:global", GLOBAL_LIMIT, WINDOW_MS);
  if (!global.allowed) return tooMany(global.retryAfterSeconds);

  const { password } = (await request.json().catch(() => ({}))) as {
    password?: string;
  };
  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const user = await prisma.user.findFirst();
  if (!user) {
    return NextResponse.json(
      { error: "No admin account exists. Run the seed script first." },
      { status: 500 }
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  reset(`login:${ip}`);

  const session = await getSession();
  session.isAdmin = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
