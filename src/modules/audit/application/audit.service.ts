import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { TransactionClient } from '@database/transaction.client';
import { Prisma } from '@prisma/client';

export interface AuditLogInput {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditQueryFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  fromDate?: Date;
  toDate?: Date;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput, tx?: TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        oldValue: input.oldValue as Prisma.InputJsonValue | undefined,
        newValue: input.newValue as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        correlationId: input.correlationId,
        requestId: input.requestId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async query(filters: AuditQueryFilters) {
    const limit = Math.min(filters.limit ?? 50, 200);
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }

    const query: Prisma.AuditLogFindManyArgs = {
      where,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true } } },
    };

    if (filters.cursor) {
      query.cursor = { id: filters.cursor };
      query.skip = 1;
    }

    const items = await this.prisma.auditLog.findMany(query);
    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;

    return {
      items: results.map((item) => ({
        id: item.id,
        timestamp: item.createdAt,
        actor: item.userId ? { id: item.userId } : null,
        action: item.action,
        targetResource: { type: item.resourceType, id: item.resourceId },
        oldValue: item.oldValue,
        newValue: item.newValue,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        correlationId: item.correlationId,
        requestId: item.requestId,
        metadata: item.metadata,
      })),
      hasMore,
      nextCursor: hasMore ? results[results.length - 1]?.id : undefined,
    };
  }
}
