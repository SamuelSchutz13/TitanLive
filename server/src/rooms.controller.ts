import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { MAX_PEERS, ROOM_ID, RoomsGateway } from './rooms.gateway';

// Lets the home page say "full" before anyone types a name. Only someone with the room id can ask.
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsGateway) {}

  @Get(':id')
  get(@Param('id') id: string) {
    if (!ROOM_ID.test(id)) throw new BadRequestException('invalid-room');
    return { count: this.rooms.count(id), max: MAX_PEERS };
  }
}
