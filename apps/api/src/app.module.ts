import { Module } from '@nestjs/common';
import { AgentModule } from './agent/agent.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';

@Module({
  imports: [ReservationsModule, AgentModule],
})
export class AppModule {}
