import { Module } from '@nestjs/common';
import { PositionsModule } from '../positions/positions.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { DevicesController } from './devices.controller.js';

@Module({
  imports: [PositionsModule, AuthModule, ConfigModule],
  controllers: [DevicesController],
})
export class DevicesModule {}
