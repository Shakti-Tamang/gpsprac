import {
  Injectable,
  Logger,
  Inject,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PositionsService } from '../positions/positions.service.js';
import { GpsAdapterPort } from '../domain/gps-adapter.port.js';
import { NormalizedPosition } from '../domain/normalized-position.js';

export const GPS_ADAPTERS_TOKEN = 'GPS_ADAPTERS';

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private readonly positionsService: PositionsService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(GPS_ADAPTERS_TOKEN)
    private readonly adapters: GpsAdapterPort[] = [],
  ) {}

  onModuleInit(): void {
    const intervalMs = Number(
      this.configService.get<number>('INGESTION_INTERVAL_MS', 5000),
    );
    this.startPolling(intervalMs);
  }

  onModuleDestroy(): void {
    this.stopPolling();
  }

  startPolling(intervalMs: number): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.logger.log(`Starting ingestion polling loop every ${intervalMs}ms`);
    this.timer = setInterval(() => {
      this.pollAll().catch((err) => {
        this.logger.error(`Error in ingestion cycle: ${err?.message || err}`);
      });
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Stopped ingestion polling loop');
    }
  }

  async pollAll(): Promise<NormalizedPosition[]> {
    if (this.isPolling) {
      this.logger.debug('Previous polling cycle still active, skipping');
      return [];
    }

    this.isPolling = true;
    const allPositions: NormalizedPosition[] = [];

    try {
      for (const adapter of this.adapters) {
        try {
          const positions = await adapter.fetchPositions();
          if (positions && positions.length > 0) {
            allPositions.push(...positions);
            this.logger.log(
              JSON.stringify({
                level: 'log',
                context: IngestionService.name,
                message: `Fetched ${positions.length} positions from ${adapter.getProviderName()}`,
                timestamp: new Date().toISOString(),
              }),
            );
          }
        } catch (adapterErr: any) {
          this.logger.error(
            `Adapter ${adapter.getProviderName()} threw error during polling: ${adapterErr?.message || adapterErr}`,
          );
        }
      }

      if (allPositions.length > 0) {
        await this.positionsService.saveMany(allPositions);
      }
    } finally {
      this.isPolling = false;
    }

    return allPositions;
  }
}
