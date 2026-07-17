import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isAdmin?: boolean;
}

const SIXTY_DAYS = 60 * 60 * 24 * 60;

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ??
    "insecure-dev-only-secret-change-me-in-env-file",
  cookieName: "records_session",
  ttl: SIXTY_DAYS,
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SESSION_SECURE === "true",
    maxAge: SIXTY_DAYS,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAdmin(): Promise<boolean> {
  const session = await getSession();
  return session.isAdmin === true;
}
