import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import axios from 'axios';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  @Get()
  async checkHealth() {
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let traccarStatus: 'connected' | 'disconnected' = 'disconnected';

    // Check DB
    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1;');
        dbStatus = 'connected';
      } else if (this.dataSource) {
        await this.dataSource.query('SELECT 1;');
        dbStatus = 'connected';
      }
    } catch {
      dbStatus = 'disconnected';
    }

    // Check Traccar
    try {
      const traccarUrl = this.configService.get<string>(
        'TRACCAR_URL',
        'http://localhost:8082',
      );
      await axios.get(traccarUrl, { timeout: 2000 });
      traccarStatus = 'connected';
    } catch {
      traccarStatus = 'disconnected';
    }

    const allHealthy = dbStatus === 'connected' && traccarStatus === 'connected';

    const responseBody = {
      status: allHealthy ? 'ok' : 'degraded',
      db: dbStatus,
      traccar: traccarStatus,
    };

    if (!allHealthy) {
      throw new HttpException(responseBody, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return responseBody;
  }
}
