import { createHmac, randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { RoleCode } from "@prisma/client";
import { db } from "@/lib/db";

const cookieName = "ordo_session";
const lifetime = 60 * 60 * 12;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  return value;
}

function hash(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export type Actor = { id: string; name: string; email: string; roles: RoleCode[] };

export async function currentUser(): Promise<Actor | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: session.user.roles.map(({ role }) => role.code),
  };
}

export function hasRole(actor: Actor, ...roles: RoleCode[]) {
  return actor.roles.includes(RoleCode.ADMINISTRADOR) || roles.some((role) => actor.roles.includes(role));
}

export function isAdministrator(actor: Actor) {
  return actor.roles.includes(RoleCode.ADMINISTRADOR);
}

export async function signIn(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const key = hash(`login:${normalized}`);
  const attempt = await db.loginAttempt.findUnique({ where: { key } });
  if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) return false;
  const user = await db.user.findUnique({ where: { email: normalized } });
  const valid = user?.active && (await compare(password, user.passwordHash));
  if (!valid) {
    const failures = (attempt?.failures ?? 0) + 1;
    await db.loginAttempt.upsert({
      where: { key },
      create: { key, failures: 1 },
      update: { failures, lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
    });
    return false;
  }
  await db.loginAttempt.deleteMany({ where: { key } });
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: hash(token), userId: user.id, expiresAt: new Date(Date.now() + lifetime * 1000) } });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: lifetime,
  });
  return true;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hash(token) } });
  jar.delete(cookieName);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(process.env.APP_ORIGIN ?? request.url).origin; } catch { return false; }
}
