import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../src/health/health.controller.js';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

describe('HealthController', () => {
  let controller: HealthController;
  let mockDataSource: {
    query: jest.Mock;
  };

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn().mockImplementation(() => Promise.resolve([{ '?column?': 1 }])),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: any) => {
              if (key === 'TRACCAR_URL') return 'http://localhost:8082';
              return defaultVal;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return 200 ok when db and traccar are reachable', async () => {
    jest.spyOn(axios, 'get').mockResolvedValueOnce({ status: 200 });

    const result = await controller.checkHealth();
    expect(result).toEqual({
      status: 'ok',
      db: 'connected',
      traccar: 'connected',
    });
  });

  it('should return 503 degraded when traccar is unreachable', async () => {
    jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Connection refused'));

    try {
      await controller.checkHealth();
      fail('Should have thrown HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(error.getResponse()).toEqual({
        status: 'degraded',
        db: 'connected',
        traccar: 'disconnected',
      });
    }
  });

  it('should return 503 degraded when db is unreachable', async () => {
    mockDataSource.query.mockRejectedValueOnce(new Error('DB connection failed'));
    jest.spyOn(axios, 'get').mockResolvedValueOnce({ status: 200 });

    try {
      await controller.checkHealth();
      fail('Should have thrown HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(error.getResponse()).toEqual({
        status: 'degraded',
        db: 'disconnected',
        traccar: 'connected',
      });
    }
  });
});
