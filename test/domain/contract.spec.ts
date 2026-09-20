import { NormalizedPosition } from '../../src/domain/normalized-position';

describe('NormalizedPosition Contract', () => {
  it('should enforce strict normalized fields', () => {
    const sample: NormalizedPosition = {
      device_id: 'test-device-1',
      provider: 'traccar',
      lat: 27.7172,
      lng: 85.324,
      speed: 45.5,
      heading: 180,
      ignition: true,
      timestamp: new Date('2026-09-18T10:00:00Z'),
      raw: { original: true },
    };
    expect(sample.device_id).toBe('test-device-1');
    expect(sample.provider).toBe('traccar');
  });
});
