import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from '../../src/ingestion/ingestion.service.js';
import { PositionsService } from '../../src/positions/positions.service.js';
import { NormalizedPosition } from '../../src/domain/normalized-position.js';
import { ConfigService } from '@nestjs/config';

describe('IngestionService', () => {
  let service: IngestionService;
  let mockPositionsService: {
    saveMany: jest.Mock;
  };
  let mockAdapter1: {
    getProviderName: jest.Mock;
    fetchPositions: jest.Mock;
  };
  let mockAdapter2: {
    getProviderName: jest.Mock;
    fetchPositions: jest.Mock;
  };

  const samplePos: NormalizedPosition = {
    device_id: 'dev-1',
    provider: 'traccar',
    lat: 10,
    lng: 20,
    speed: 30,
    heading: 90,
    ignition: true,
    timestamp: new Date(),
    raw: {},
  };

  beforeEach(async () => {
    mockPositionsService = {
      saveMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    };

    mockAdapter1 = {
      getProviderName: jest.fn().mockReturnValue('adapter-1'),
      fetchPositions: jest.fn().mockImplementation(() => Promise.resolve([samplePos])),
    };

    mockAdapter2 = {
      getProviderName: jest.fn().mockReturnValue('adapter-2'),
      fetchPositions: jest.fn().mockImplementation(() => Promise.resolve([])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: PositionsService,
          useValue: mockPositionsService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: any) => {
              if (key === 'INGESTION_INTERVAL_MS') return 5000;
              return defaultVal;
            }),
          },
        },
        {
          provide: 'GPS_ADAPTERS',
          useValue: [mockAdapter1, mockAdapter2],
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should poll all registered adapters and save positions', async () => {
    await service.pollAll();

    expect(mockAdapter1.fetchPositions).toHaveBeenCalled();
    expect(mockAdapter2.fetchPositions).toHaveBeenCalled();
    expect(mockPositionsService.saveMany).toHaveBeenCalledWith([samplePos]);
  });

  it('should continue polling other adapters if one throws an error', async () => {
    mockAdapter1.fetchPositions.mockRejectedValueOnce(new Error('Network error'));
    const pos2: NormalizedPosition = { ...samplePos, device_id: 'dev-2' };
    mockAdapter2.fetchPositions.mockResolvedValueOnce([pos2]);

    await service.pollAll();

    expect(mockAdapter2.fetchPositions).toHaveBeenCalled();
    expect(mockPositionsService.saveMany).toHaveBeenCalledWith([pos2]);
  });
});
