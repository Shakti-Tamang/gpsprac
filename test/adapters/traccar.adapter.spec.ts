import { jest } from '@jest/globals';
import { TraccarAdapter } from '../../src/adapters/traccar/traccar.adapter.js';
import { TraccarMapper } from '../../src/adapters/traccar/traccar.mapper.js';
import axios from 'axios';

describe('TraccarAdapter', () => {
  let adapter: TraccarAdapter;
  let mapper: TraccarMapper;

  beforeEach(() => {
    mapper = new TraccarMapper();
    adapter = new TraccarAdapter(
      {
        url: 'http://localhost:8082',
        username: 'admin',
        password: 'admin',
      },
      mapper,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should identify provider as "traccar"', () => {
    expect(adapter.getProviderName()).toBe('traccar');
  });

  it('should map Traccar API positions into NormalizedPosition array', async () => {
    const rawTraccarData = [
      {
        id: 101,
        deviceId: 999,
        protocol: 'osmand',
        serverTime: '2026-09-18T10:00:00.000+00:00',
        deviceTime: '2026-09-18T10:00:00.000+00:00',
        fixTime: '2026-09-18T10:00:00.000+00:00',
        outdated: false,
        valid: true,
        latitude: 27.7172,
        longitude: 85.324,
        altitude: 1300.0,
        speed: 24.3, // knots
        course: 180.0,
        address: null,
        accuracy: 0.0,
        network: null,
        attributes: {
          ignition: true,
          batteryLevel: 95,
        },
      },
    ];

    jest.spyOn(axios, 'get').mockImplementation(async (url: any) => {
      if (typeof url === 'string' && url.includes('/api/devices')) {
        return { status: 200, data: [{ id: 999, uniqueId: 'sim-device-999' }] };
      }
      return { status: 200, data: rawTraccarData };
    });

    const positions = await adapter.fetchPositions();

    expect(positions).toHaveLength(1);
    const p = positions[0];
    expect(p.device_id).toBe('sim-device-999');
    expect(p.provider).toBe('traccar');
    expect(p.lat).toBe(27.7172);
    expect(p.lng).toBe(85.324);
    // 24.3 knots * 1.852 = 45.0036 km/h
    expect(p.speed).toBeCloseTo(45.0, 0);
    expect(p.heading).toBe(180);
    expect(p.ignition).toBe(true);
    expect(p.timestamp).toEqual(new Date('2026-09-18T10:00:00.000+00:00'));
    expect(p.raw).toEqual(rawTraccarData[0]);
  });

  it('should handle null/missing optional fields cleanly', () => {
    const raw = {
      deviceId: 'dev-unknown',
      latitude: 10.0,
      longitude: 20.0,
      fixTime: '2026-09-18T10:00:00Z',
    };
    const mapped = mapper.toNormalized(raw);
    expect(mapped.device_id).toBe('dev-unknown');
    expect(mapped.speed).toBeNull();
    expect(mapped.heading).toBeNull();
    expect(mapped.ignition).toBeNull();
  });

  it('should be resilient: return empty array and log error on 500 or connection failure', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Connection refused: 8082'));

    const positions = await adapter.fetchPositions();
    expect(positions).toEqual([]);
  });
});
