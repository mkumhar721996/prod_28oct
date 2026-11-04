import { NotFoundException } from '@nestjs/common';
import { PlayerRequest } from '../session/session.guard';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

const reqA = { player: { id: 'A' } } as unknown as PlayerRequest;

function setup(overrides: Partial<Record<keyof AlertsService, unknown>> = {}) {
  const service = {
    listFor: jest.fn(async () => [{ id: '1' }]),
    unreadCountFor: jest.fn(async () => 3),
    markRead: jest.fn(async () => ({ id: '7', read: true })),
    ...overrides,
  };
  return { service, controller: new AlertsController(service as unknown as AlertsService) };
}

describe('AlertsController', () => {
  it('lists with the session player id only', async () => {
    const { controller, service } = setup();
    await expect(controller.list(reqA)).resolves.toEqual({ alerts: [{ id: '1' }] });
    expect(service.listFor).toHaveBeenCalledWith('A');
  });

  it('returns the unread count', async () => {
    const { controller, service } = setup();
    await expect(controller.unreadCount(reqA)).resolves.toEqual({ unreadCount: 3 });
    expect(service.unreadCountFor).toHaveBeenCalledWith('A');
  });

  it('marks one alert read for the session player', async () => {
    const { controller, service } = setup();
    await expect(controller.read(reqA, '7')).resolves.toEqual({ id: '7', read: true });
    expect(service.markRead).toHaveBeenCalledWith('A', '7');
  });

  it('404s for another customer’s alert', async () => {
    const { controller } = setup({ markRead: jest.fn(async () => null) });
    await expect(controller.read(reqA, '7')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['abc', '1.5', '-1', '99999999999999999999'])('404s for id %s without querying', async (id) => {
    const { controller, service } = setup();
    await expect(controller.read(reqA, id)).rejects.toBeInstanceOf(NotFoundException);
    expect(service.markRead).not.toHaveBeenCalled();
  });
});
