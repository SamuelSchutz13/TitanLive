import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RoomsGateway } from './rooms.gateway';

@Module({
  controllers: [HealthController],
  providers: [RoomsGateway],
})
export class AppModule {}
