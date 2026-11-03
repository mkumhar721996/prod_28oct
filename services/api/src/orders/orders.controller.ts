import { BadRequestException, Body, Controller, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { OrdersService, PlaceOrderInput } from './orders.service';

const isText = (v: unknown): v is string => typeof v === 'string';

@Controller('orders')
@UseGuards(SessionGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** The customer id comes from the session only, never from the body. */
  @Post()
  async place(
    @Req() req: PlayerRequest,
    @Body() body: PlaceOrderInput,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const { fulfilment, name, phone, address, lines, idempotencyKey } = body ?? ({} as PlaceOrderInput);
    if (
      ![fulfilment, name, phone, idempotencyKey].every(isText) ||
      !(address === undefined || address === null || isText(address)) ||
      !Array.isArray(lines)
    ) {
      throw new BadRequestException('Check your order details.');
    }
    const result = await this.orders.place(req.player.id, {
      fulfilment,
      name,
      phone,
      address: address ?? undefined,
      lines,
      idempotencyKey,
    });
    if (!result.ok) {
      throw new BadRequestException({ code: result.code, message: 'That order is not valid.' });
    }
    res?.status(result.replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return { order: result.order };
  }
}
