import {
  Controller,
  Get,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { PositionsService } from '../positions/positions.service.js';
import { ApiKeyGuard } from '../auth/api-key.guard.js';

@Controller('devices')
@UseGuards(ApiKeyGuard)
export class DevicesController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get(':id/latest')
  async getLatest(@Param('id') id: string) {
    const position = await this.positionsService.getLatestByDeviceId(id);

    if (!position) {
      throw new NotFoundException('Device not found');
    }

    return {
      device_id: position.device_id,
      provider: position.provider,
      lat: position.lat,
      lng: position.lng,
      speed: position.speed,
      heading: position.heading,
      ignition: position.ignition,
      timestamp: position.timestamp,
    };
  }
}
