import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReservationsService, maskCpf } from './reservations.service.js';
import type { CreateReservationInput, Reservation } from './reservations.types.js';

const mask = (r: Reservation): Reservation => ({
  ...r,
  customer: { ...r.customer, cpf: maskCpf(r.customer.cpf) },
});

@Controller()
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Get('courts')
  courts() {
    return this.service.listCourts();
  }

  @Get('availability')
  availability(@Query('date') date: string) {
    return this.service.getAvailability(date);
  }

  @Get('reservations')
  list(@Query('cpf') cpf?: string) {
    return this.service.list({ cpf }).map(mask);
  }

  @Get('reservations/:id')
  get(@Param('id') id: string) {
    return mask(this.service.get(id));
  }

  @Post('reservations')
  create(@Body() body: CreateReservationInput) {
    return mask(this.service.create(body));
  }

  @Patch('reservations/:id/cancel')
  cancel(@Param('id') id: string) {
    return mask(this.service.cancel(id));
  }
}
