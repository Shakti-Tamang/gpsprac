import { Injectable, Logger, Inject } from '@nestjs/common';
import axios from 'axios';
import { GpsAdapterPort } from '../../domain/gps-adapter.port.js';
import { NormalizedPosition } from '../../domain/normalized-position.js';
import type { TraccarConfig } from './traccar.config.js';
import { TraccarMapper } from './traccar.mapper.js';

export const TRACCAR_CONFIG_TOKEN = 'TRACCAR_CONFIG_TOKEN';

@Injectable()
export class TraccarAdapter extends GpsAdapterPort {
  private readonly logger = new Logger(TraccarAdapter.name);

  constructor(
    @Inject(TRACCAR_CONFIG_TOKEN)
    private readonly config: TraccarConfig,
    private readonly mapper: TraccarMapper,
  ) {
    super();
  }

  getProviderName(): string {
    return 'traccar';
  }

  private deviceMap: Map<number, string> = new Map();
  private lastDeviceSync = 0;

  private async syncDevices(): Promise<void> {
    const now = Date.now();
    if (now - this.lastDeviceSync < 30000 && this.deviceMap.size > 0) {
      return;
    }
    try {
      const endpoint = `${this.config.url.replace(/\/$/, '')}/api/devices`;
      const res = await axios.get(endpoint, {
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
        timeout: 5000,
      });
      if (Array.isArray(res.data)) {
        for (const dev of res.data) {
          if (dev.id && dev.uniqueId) {
            this.deviceMap.set(dev.id, dev.uniqueId);
          }
        }
        this.lastDeviceSync = now;
      }
    } catch {
      // Non-fatal, fallback to deviceId
    }
  }

  async fetchPositions(): Promise<NormalizedPosition[]> {
    try {
      await this.syncDevices();

      const endpoint = `${this.config.url.replace(/\/$/, '')}/api/positions`;
      const response = await axios.get(endpoint, {
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
        headers: {
          Accept: 'application/json',
        },
        timeout: 5000,
      });

      if (!Array.isArray(response.data)) {
        return [];
      }

      return response.data.map((rawItem: Record<string, any>) => {
        const uniqueId = rawItem.deviceId ? this.deviceMap.get(rawItem.deviceId) : undefined;
        return this.mapper.toNormalized(rawItem, uniqueId);
      });
    } catch (error: any) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          context: TraccarAdapter.name,
          message: 'Failed to fetch positions from Traccar API',
          error: error?.message || error,
        }),
      );
      return [];
    }
  }
}
