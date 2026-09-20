import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DevicesController } from '../../src/devices/devices.controller.js';
import { PositionsService } from '../../src/positions/positions.service.js';
import { ApiKeyGuard } from '../../src/auth/api-key.guard.js';
import { ConfigService } from '@nestjs/config';

describe('DevicesController', () => {
  let controller: DevicesController;
  let mockPositionsService: {
    getLatestByDeviceId: jest.Mock;
  };

  const sampleRecord = {
    id: '1',
    device_id: 'device-123',
    provider: 'traccar',
    lat: 27.7172,
    lng: 85.324,
    speed: 45.0,
    heading: 180,
    ignition: true,
    timestamp: new Date('2026-09-18T10:00:00.000Z'),
    raw: {},
    created_at: new Date('2026-09-18T10:00:00.000Z'),
  };

  beforeEach(async () => {
    mockPositionsService = {
      getLatestByDeviceId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        {
          provide: PositionsService,
          useValue: mockPositionsService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key-12345'),
          },
        },
        ApiKeyGuard,
      ],
    }).compile();

    controller = module.get<DevicesController>(DevicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return latest position for device', async () => {
    mockPositionsService.getLatestByDeviceId.mockResolvedValueOnce(sampleRecord);

    const result = await controller.getLatest('device-123');

    expect(mockPositionsService.getLatestByDeviceId).toHaveBeenCalledWith('device-123');
    expect(result).toEqual({
      device_id: 'device-123',
      provider: 'traccar',
      lat: 27.7172,
      lng: 85.324,
      speed: 45.0,
      heading: 180,
      ignition: true,
      timestamp: sampleRecord.timestamp,
    });
  });

  it('should throw NotFoundException if device does not exist', async () => {
    mockPositionsService.getLatestByDeviceId.mockResolvedValueOnce(null);

    await expect(controller.getLatest('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
