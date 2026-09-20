import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PositionEntity } from './positions/position.entity.js';
import { DomainModule } from './domain/domain.module.js';
import { PositionsModule } from './positions/positions.module.js';
import { TraccarModule } from './adapters/traccar/traccar.module.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<number>('DB_PORT', 5432)),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_DATABASE', 'gpstracker'),
        entities: [PositionEntity],
        synchronize: true,
      }),
    }),
    DomainModule,
    PositionsModule,
    TraccarModule,
    IngestionModule,
    DevicesModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
