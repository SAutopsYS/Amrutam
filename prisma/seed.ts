import { PrismaClient, UserStatus, VerificationStatus, SlotStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const roles = ['Patient', 'Doctor', 'Admin', 'Super Admin'];
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} role` },
    });
  }

  const specializations = [
    { name: 'Ayurveda', slug: 'ayurveda' },
    { name: 'General Physician', slug: 'general-physician' },
    { name: 'Dermatology', slug: 'dermatology' },
    { name: 'Pediatrics', slug: 'pediatrics' },
    { name: 'Nutrition', slug: 'nutrition' },
    { name: 'Yoga', slug: 'yoga' },
  ];

  for (const spec of specializations) {
    await prisma.specialization.upsert({
      where: { slug: spec.slug },
      update: {},
      create: spec,
    });
  }

  const patientRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Patient' } });
  const doctorRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Doctor' } });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const patient = await prisma.user.upsert({
    where: { email: 'patient@amrutam.test' },
    update: {},
    create: {
      email: 'patient@amrutam.test',
      phone: '919876543210',
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Test',
          lastName: 'Patient',
          timezone: 'Asia/Kolkata',
        },
      },
      roles: { create: { roleId: patientRole.id } },
    },
  });

  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@amrutam.test' },
    update: {},
    create: {
      email: 'doctor@amrutam.test',
      phone: '919876543211',
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Test',
          lastName: 'Doctor',
          timezone: 'Asia/Kolkata',
        },
      },
      roles: { create: { roleId: doctorRole.id } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@amrutam.test' },
    update: {},
    create: {
      email: 'admin@amrutam.test',
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: { firstName: 'Test', lastName: 'Admin', timezone: 'Asia/Kolkata' },
      },
      roles: { create: { roleId: adminRole.id } },
    },
  });

  const ayurveda = await prisma.specialization.findUniqueOrThrow({ where: { slug: 'ayurveda' } });

  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      medicalLicenseNumber: 'MED-TEST-001',
      verificationStatus: VerificationStatus.VERIFIED,
      yearsOfExperience: 10,
      consultationFee: 500,
      bio: 'Experienced Ayurveda practitioner',
      supportsOnline: true,
      qualifications: ['BAMS'],
      languagesSpoken: ['en', 'hi'],
      specializations: { create: { specializationId: ayurveda.id } },
    },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const slotEnd = new Date(tomorrow);
  slotEnd.setMinutes(30);

  await prisma.availabilitySlot.upsert({
    where: { doctorId_startTime: { doctorId: doctor.id, startTime: tomorrow } },
    update: {},
    create: {
      doctorId: doctor.id,
      startTime: tomorrow,
      endTime: slotEnd,
      status: SlotStatus.AVAILABLE,
    },
  });

  console.log('Seed completed:', { patientId: patient.id, doctorId: doctor.id });
  console.log('Test users: patient@amrutam.test, doctor@amrutam.test, admin@amrutam.test (Password123!)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
