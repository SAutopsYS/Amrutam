import { Prisma } from '@prisma/client';

/** Transaction client type for repository methods participating in ACID flows. */
export type TransactionClient = Prisma.TransactionClient;
