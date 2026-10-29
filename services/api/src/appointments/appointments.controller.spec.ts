import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PlayerRequest } from '../session/session.guard';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

const req = { player: { id: 'p1' } } as unknown as PlayerRequest;
const body = { clinicId: 'north', date: '2026-11-02', time: '09:00', reason: '' };

function setup(overrides: Partial<Record<keyof AppointmentsService, unknown>> = {}) {
  const service = {
    listClinics: jest.fn(() => [{ id: 'north', name: 'North Clinic' }]),
    slotsForClinic: jest.fn(async () => [{ date: '2026-11-02', times: ['09:00'] }]),
    listFor: jest.fn(async () => []),
    book: jest.fn(async () => ({ ok: true, appointment: { id: 'a1' } })),
    ...overrides,
  };
  return { service, controller: new AppointmentsController(service as unknown as AppointmentsService) };
}

describe('AppointmentsController', () => {
  it('lists clinics as id, name and hours text only', () => {
    const { controller } = setup({
      listClinics: jest.fn(() => [
        { id: 'north', name: 'North Clinic', hoursText: 'Open Mondays', timeZone: 'Europe/London', hours: {} },
      ]),
    });
    expect(controller.clinics()).toEqual([
      { id: 'north', name: 'North Clinic', hoursText: 'Open Mondays' },
    ]);
  });

  it('GET slots is a 404 for an unknown clinic', async () => {
    const { controller } = setup({ slotsForClinic: jest.fn(async () => null) });
    await expect(controller.slots('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET /appointments reads the session patient only', async () => {
    const { controller, service } = setup();
    await controller.list(req);
    expect(service.listFor).toHaveBeenCalledWith('p1');
  });

  it('POST books for the session patient', async () => {
    const { controller, service } = setup();
    expect(await controller.book(req, body)).toEqual({ appointment: { id: 'a1' } });
    expect(service.book).toHaveBeenCalledWith('p1', body);
  });

  it.each([
    ['slot_taken', 'That time is no longer available. Pick another time. Nothing has been booked.'],
    ['already_booked', 'You already have an appointment at this time. Pick a different time.'],
  ])('POST is a 409 with code %s', async (code, message) => {
    const { controller } = setup({ book: jest.fn(async () => ({ ok: false, code })) });
    const err = await controller.book(req, body).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse()).toMatchObject({ code, message });
  });

  it.each(['not_offered', 'reason_too_long', 'unknown_clinic'])('POST is a 400 for %s', async (code) => {
    const { controller } = setup({ book: jest.fn(async () => ({ ok: false, code })) });
    await expect(controller.book(req, body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('POST is a 400 for a malformed body', async () => {
    const { controller, service } = setup();
    await expect(controller.book(req, { clinicId: 1 } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.book).not.toHaveBeenCalled();
  });

  it('lets an unexpected failure through as a server error', async () => {
    const { controller } = setup({
      book: jest.fn(async () => {
        throw new Error('db down');
      }),
    });
    await expect(controller.book(req, body)).rejects.toThrow('db down');
  });
});
