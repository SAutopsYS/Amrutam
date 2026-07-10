import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { RedisModule } from '@database/redis.module';
import { winstonConfig } from '@/logger/winston.config';
import { GlobalExceptionFilter } from '@/filters/global-exception.filter';
import { ResponseInterceptor } from '@/interceptors/response.interceptor';
import { LoggingInterceptor } from '@/interceptors/logging.interceptor';
import { UserContextInterceptor } from '@/interceptors/user-context.interceptor';
import { MetricsInterceptor } from '@/metrics/metrics.interceptor';
import { RequestContextMiddleware } from '@/middlewares/request-context.middleware';
import { EventsModule } from '@/events/events.module';
import { HealthModule } from '@/health/health.module';
import { TelemetryModule } from '@/telemetry/telemetry.module';
import { MetricsModule } from '@/metrics/metrics.module';
import { CacheModule } from '@common/cache/cache.module';
import { ShutdownModule } from '@/shutdown/shutdown.module';
import { AuditModule } from '@modules/audit/audit.module';
import { AuthModule } from '@modules/auth/auth.module';
import { RbacModule } from '@modules/rbac/rbac.module';
import { BookingsModule } from '@modules/bookings/bookings.module';
import { ConsultationsModule } from '@modules/consultations/consultations.module';
import { PrescriptionsModule } from '@modules/prescriptions/prescriptions.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { EventProcessingModule } from '@modules/event-processing/event-processing.module';
import { AdminModule } from '@modules/admin/admin.module';
import { DoctorsModule } from '@modules/doctors/doctors.module';
import { QueueModule } from '@/queues/queue.module';
import { JwtAuthGuard } from '@modules/auth/infrastructure/jwt-auth.guard';

@Module({
  imports: [
    AppConfigModule,
    winstonConfig,
    TelemetryModule,
    MetricsModule,
    CacheModule,
    ShutdownModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('app.throttleTtl') ?? 60000,
          limit: config.get<number>('app.throttleLimit') ?? 100,
        },
      ],
    }),
    DatabaseModule,
    RedisModule,
    EventsModule,
    HealthModule,
    AuditModule,
    AuthModule,
    RbacModule,
    BookingsModule,
    ConsultationsModule,
    PrescriptionsModule,
    PaymentsModule,
    NotificationsModule,
    QueueModule,
    EventProcessingModule,
    AdminModule,
    DoctorsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: UserContextInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
