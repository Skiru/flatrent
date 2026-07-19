import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { JsonLogger } from '../../../src/shared/infrastructure/logging/json-logger.service';

describe('Health and Metrics Endpoints E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(new JsonLogger());
    app.enableShutdownHooks();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return UP for GET /health', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'UP' });
  });

  it('should return Prometheus metrics for GET /metrics', async () => {
    const response = await request(app.getHttpServer()).get('/metrics').expect(200);

    expect(response.text).toContain('flatren_queue_lag_ms');
    expect(response.text).toContain('flatren_outbox_retry_attempts_total');
    expect(response.text).toContain('flatren_inbox_retry_attempts_total');
    expect(response.text).toContain('flatren_redis_degraded');
  });
});
