import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PositionsModule } from '../positions/positions.module.js';
import { TraccarModule } from '../adapters/traccar/traccar.module.js';
import { TraccarAdapter } from '../adapters/traccar/traccar.adapter.js';
import { IngestionService, GPS_ADAPTERS_TOKEN } from './ingestion.service.js';

@Module({
  imports: [ConfigModule, PositionsModule, TraccarModule],
  providers: [
    {
      provide: GPS_ADAPTERS_TOKEN,
      useFactory: (traccarAdapter: TraccarAdapter) => [traccarAdapter],
      inject: [TraccarAdapter],
    },
    IngestionService,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
