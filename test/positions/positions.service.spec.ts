import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PositionsService } from '../../src/positions/positions.service.js';
import { PositionEntity } from '../../src/positions/position.entity.js';
import { NormalizedPosition } from '../../src/domain/normalized-position.js';

describe('PositionsService', () => {
  let service: PositionsService;
  let mockRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    query: jest.Mock;
  };

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((dto) => Promise.resolve(dto)),
      findOne: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionsService,
        {
          provide: getRepositoryToken(PositionEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PositionsService>(PositionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should map and save a single NormalizedPosition', async () => {
    const pos: NormalizedPosition = {
      device_id: 'dev-1',
      provider: 'traccar',
      lat: 27.7172,
      lng: 85.324,
      speed: 50.0,
      heading: 90,
      ignition: true,
      timestamp: new Date('2026-09-18T12:00:00Z'),
      raw: { test: 123 },
    };

    const saved = await service.savePosition(pos);
    expect(mockRepository.create).toHaveBeenCalledWith(pos);
    expect(mockRepository.save).toHaveBeenCalledWith(pos);
    expect(saved.device_id).toBe('dev-1');
  });

  it('should save multiple NormalizedPositions in saveMany', async () => {
    const posList: NormalizedPosition[] = [
      {
        device_id: 'dev-1',
        provider: 'traccar',
        lat: 27.7172,
        lng: 85.324,
        speed: 50.0,
        heading: 90,
        ignition: true,
        timestamp: new Date('2026-09-18T12:00:00Z'),
        raw: {},
      },
    ];

    await service.saveMany(posList);
    expect(mockRepository.create).toHaveBeenCalledWith(posList[0]);
    expect(mockRepository.save).toHaveBeenCalled();
  });

  it('should query latest position ordered by timestamp DESC', async () => {
    const mockRecord = {
      id: '1',
      device_id: 'dev-1',
      timestamp: new Date(),
    };
    mockRepository.findOne.mockResolvedValue(mockRecord);

    const result = await service.getLatestByDeviceId('dev-1');
    expect(mockRepository.findOne).toHaveBeenCalledWith({
      where: { device_id: 'dev-1' },
      order: { timestamp: 'DESC' },
    });
    expect(result).toEqual(mockRecord);
  });
});
