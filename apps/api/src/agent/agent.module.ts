import { Module } from '@nestjs/common';
import { ReservationsModule } from '../reservations/reservations.module.js';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';

@Module({
  imports: [ReservationsModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
