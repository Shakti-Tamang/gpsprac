import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PositionEntity } from './position.entity.js';
import { PositionsService } from './positions.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PositionEntity])],
  providers: [PositionsService],
  exports: [PositionsService, TypeOrmModule],
})
export class PositionsModule {}
