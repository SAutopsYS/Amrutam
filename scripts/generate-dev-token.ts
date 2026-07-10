/**
 * Generate a development JWT for Swagger / API testing.
 * Usage: npm run token:patient | npm run token:doctor
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const role = process.argv[2] ?? 'patient';
  const emailMap: Record<string, string> = {
    patient: 'patient@amrutam.test',
    doctor: 'doctor@amrutam.test',
    admin: 'admin@amrutam.test',
  };
  const email = emailMap[role] ?? emailMap.patient;

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    console.error('JWT_ACCESS_SECRET must be set (32+ chars) in .env');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });

  if (!user) {
    console.error(`User ${email} not found. Run: npm run prisma:seed`);
    process.exit(1);
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role.name),
    },
    secret,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' },
  );

  console.log(`\nToken for ${email} (${user.roles.map((r) => r.role.name).join(', ')}):\n`);
  console.log(token);
  console.log('\nUse in Swagger: Authorize → Bearer <token>\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
