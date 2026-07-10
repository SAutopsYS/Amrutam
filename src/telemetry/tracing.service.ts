import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
let sdk: NodeSDK | null = null;

@Injectable()
export class TracingService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    if (!this.configService.get<boolean>('telemetry.enabled')) {
      return;
    }

    const serviceName =
      this.configService.get<string>('telemetry.serviceName') ?? 'amrutam-backend';
    const serviceVersion = this.configService.get<string>('telemetry.serviceVersion') ?? '1.0.0';

    const endpoint = this.configService.get<string>('telemetry.jaegerEndpoint');

    sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
      }),
      traceExporter: endpoint ? new OTLPTraceExporter({ url: endpoint }) : undefined,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-ioredis': { enabled: true },
        }),
      ],
    });

    sdk.start();
  }

  async shutdown(): Promise<void> {
    if (sdk) {
      await sdk.shutdown();
      sdk = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }
}
