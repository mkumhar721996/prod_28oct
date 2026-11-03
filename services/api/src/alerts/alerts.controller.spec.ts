import { NotFoundException } from '@nestjs/common';
import { PlayerRequest } from '../session/session.guard';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

const reqA = { player: { id: 'A' } } as unknown as PlayerRequest;
const ID = '3f0c7c9e-2d6b-4a55-9a53-0a1b2c3d4e5f';

function setup(overrides: Partial<Record<keyof AlertsService, unknown>> = {}) {
  const service = {
    listFor: jest.fn(async () => []),
    unreadCountFor: jest.fn(async () => 3),
    markRead: jest.fn(async () => ({ id: ID, read: true })),
    ...overrides,
  };
  return { service, controller: new AlertsController(service as unknown as AlertsService) };
}

describe('AlertsController', () => {
  it('lists with the session player id only', async () => {
    const { controller, service } = setup();
    await controller.list(reqA);
    expect(service.listFor).toHaveBeenCalledWith('A');
  });

  it('returns the unread count', async () => {
    const { controller, service } = setup();
    await expect(controller.unreadCount(reqA)).resolves.toEqual({ count: 3 });
    expect(service.unreadCountFor).toHaveBeenCalledWith('A');
  });

  it('marks one alert read for the session player', async () => {
    const { controller, service } = setup();
    await expect(controller.read(reqA, ID)).resolves.toEqual({ id: ID, read: true });
    expect(service.markRead).toHaveBeenCalledWith('A', ID);
  });

  it('is a 404 for another customer’s alert', async () => {
    const { controller } = setup({ markRead: jest.fn(async () => null) });
    await expect(controller.read(reqA, ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('is a 404 for an id that is not a uuid, without querying', async () => {
    const { controller, service } = setup();
    await expect(controller.read(reqA, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(service.markRead).not.toHaveBeenCalled();
  });
});
