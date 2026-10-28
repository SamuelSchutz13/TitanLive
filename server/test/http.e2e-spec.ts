import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupSwagger } from '../src/swagger';

describe('HTTP (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    setupSwagger(app);
    await app.init();
  });
  afterAll(() => app.close());

  it('GET /health', () =>
    request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' }));

  it('serves the OpenAPI doc', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(Object.keys((res.body as { paths: object }).paths)).toEqual([
      '/health',
    ]);
  });
});
