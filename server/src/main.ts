import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: { origin: process.env.WEB_ORIGIN ?? true },
  });
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
