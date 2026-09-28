import "dotenv/config";
import { PrismaClient, RoleCode } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();
async function main() {
  for (const code of Object.values(RoleCode)) await db.role.upsert({ where: { code }, create: { code }, update: {} });
  const email = process.env.SEED_MANAGER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_MANAGER_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error("Configura SEED_MANAGER_EMAIL y SEED_MANAGER_PASSWORD (12+ caracteres).");
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: "Gerencia", passwordHash: await hash(password, 12) },
    update: {}, // el seed nunca restablece una contraseña existente
  });
  for (const code of [RoleCode.GERENTE, RoleCode.ASESOR]) {
    const role = await db.role.findUniqueOrThrow({ where: { code } });
    await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, create: { userId: user.id, roleId: role.id }, update: {} });
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail || adminPassword) {
    if (!adminEmail || !adminPassword || adminPassword.length < 12 || adminEmail === email) throw new Error("SEED_ADMIN_EMAIL distinto a gerencia y SEED_ADMIN_PASSWORD (12+ caracteres) son obligatorios juntos.");
    const admin = await db.user.upsert({ where: { email: adminEmail }, create: { email: adminEmail, name: "Administración técnica", passwordHash: await hash(adminPassword, 12) }, update: {} });
    const role = await db.role.findUniqueOrThrow({ where: { code: RoleCode.ADMINISTRADOR } });
    await db.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: role.id } }, create: { userId: admin.id, roleId: role.id }, update: {} });
  }
  console.log(`Roles creados; acceso inicial configurado para ${email}`);
}
main().finally(() => db.$disconnect());
