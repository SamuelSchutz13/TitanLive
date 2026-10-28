import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupSwagger } from '../src/swagger';

describe('HTTP (e2e)', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    setupSwagger(app);
    await app.listen(0);
    url = await app.getUrl();
  });
  afterAll(() => app.close());

  it('GET /health', () =>
    request(url).get('/health').expect(200, { status: 'ok' }));

  it('serves the OpenAPI doc', async () => {
    const res = await request(url).get('/docs-json').expect(200);
    expect(Object.keys((res.body as { paths: object }).paths)).toEqual([
      '/health',
    ]);
  });
});
