import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';

@Module({
  controllers: [HealthController, RoomsController],
  providers: [RoomsGateway],
})
export class AppModule {}
