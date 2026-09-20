import { Injectable } from '@nestjs/common';
import { NormalizedPosition } from '../../domain/normalized-position.js';

@Injectable()
export class TraccarMapper {
  toNormalized(raw: Record<string, any>, uniqueId?: string): NormalizedPosition {
    const deviceId = uniqueId || String(raw.deviceId ?? raw.device_id ?? 'unknown');
    const lat = typeof raw.latitude === 'number' ? raw.latitude : Number(raw.lat ?? 0);
    const lng = typeof raw.longitude === 'number' ? raw.longitude : Number(raw.lng ?? 0);

    let speed: number | null = null;
    if (typeof raw.speed === 'number' && !isNaN(raw.speed)) {
      // Traccar REST API reports speed in knots: 1 knot = 1.852 km/h
      speed = raw.speed * 1.852;
    }

    let heading: number | null = null;
    const courseVal = raw.course ?? raw.heading;
    if (typeof courseVal === 'number' && !isNaN(courseVal)) {
      heading = courseVal;
    }

    let ignition: boolean | null = null;
    if (raw.attributes && typeof raw.attributes.ignition === 'boolean') {
      ignition = raw.attributes.ignition;
    } else if (typeof raw.ignition === 'boolean') {
      ignition = raw.ignition;
    }

    const timeString = raw.fixTime ?? raw.deviceTime ?? raw.serverTime ?? raw.timestamp;
    const timestamp = timeString ? new Date(timeString) : new Date();

    return {
      device_id: deviceId,
      provider: 'traccar',
      lat,
      lng,
      speed,
      heading,
      ignition,
      timestamp,
      raw,
    };
  }
}
