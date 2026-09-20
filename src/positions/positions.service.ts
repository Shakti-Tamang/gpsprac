import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PositionEntity } from './position.entity.js';
import { NormalizedPosition } from '../domain/normalized-position.js';

@Injectable()
export class PositionsService implements OnModuleInit {
  private readonly logger = new Logger(PositionsService.name);

  constructor(
    @InjectRepository(PositionEntity)
    private readonly positionRepository: Repository<PositionEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.positionRepository.query(
        "SELECT create_hypertable('positions', 'timestamp', if_not_exists => TRUE);",
      );
      this.logger.log('TimescaleDB hypertable verified for positions table');
    } catch (error: any) {
      this.logger.warn(
        `Could not create TimescaleDB hypertable (might be non-Timescale PostgreSQL or permission issue): ${error?.message || error}`,
      );
    }
  }

  async savePosition(pos: NormalizedPosition): Promise<PositionEntity> {
    const entity = this.positionRepository.create({
      device_id: pos.device_id,
      provider: pos.provider,
      lat: pos.lat,
      lng: pos.lng,
      speed: pos.speed,
      heading: pos.heading,
      ignition: pos.ignition,
      timestamp: pos.timestamp,
      raw: pos.raw,
    });
    return await this.positionRepository.save(entity);
  }

  async saveMany(positions: NormalizedPosition[]): Promise<PositionEntity[]> {
    if (!positions || positions.length === 0) {
      return [];
    }
    const entities = positions.map((pos) =>
      this.positionRepository.create({
        device_id: pos.device_id,
        provider: pos.provider,
        lat: pos.lat,
        lng: pos.lng,
        speed: pos.speed,
        heading: pos.heading,
        ignition: pos.ignition,
        timestamp: pos.timestamp,
        raw: pos.raw,
      }),
    );
    return await this.positionRepository.save(entities);
  }

  async getLatestByDeviceId(deviceId: string): Promise<PositionEntity | null> {
    return await this.positionRepository.findOne({
      where: { device_id: deviceId },
      order: { timestamp: 'DESC' },
    });
  }
}
