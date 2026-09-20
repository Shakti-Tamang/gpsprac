import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TraccarAdapter, TRACCAR_CONFIG_TOKEN } from './traccar.adapter.js';
import { TraccarMapper } from './traccar.mapper.js';
import { GpsAdapterPort } from '../../domain/gps-adapter.port.js';

@Module({
  imports: [ConfigModule],
  providers: [
    TraccarMapper,
    {
      provide: TRACCAR_CONFIG_TOKEN,
      useFactory: (configService: ConfigService) => ({
        url: configService.get<string>('TRACCAR_URL', 'http://localhost:8082'),
        username: configService.get<string>('TRACCAR_USERNAME', 'admin'),
        password: configService.get<string>('TRACCAR_PASSWORD', 'admin'),
      }),
      inject: [ConfigService],
    },
    TraccarAdapter,
    {
      provide: GpsAdapterPort,
      useExisting: TraccarAdapter,
    },
  ],
  exports: [TraccarAdapter, TraccarMapper, GpsAdapterPort, TRACCAR_CONFIG_TOKEN],
})
export class TraccarModule {}
