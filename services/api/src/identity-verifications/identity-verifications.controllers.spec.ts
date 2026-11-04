import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SessionGuard } from '../session/session.guard';
import { StaffGuard } from '../staff/staff.guard';
import { IdentityVerificationsController } from './identity-verifications.controller';
import { IdentityVerificationsService } from './identity-verifications.service';
import { IdentityVerificationsStaffController } from './identity-verifications.staff.controller';

const guards = (target: object): unknown[] => Reflect.getMetadata('__guards__', target) ?? [];

function setup() {
  const service = {
    listPending: jest.fn(async () => []),
    listDecided: jest.fn(async () => []),
    get: jest.fn(),
    decide: jest.fn(),
    latestFor: jest.fn(),
    submit: jest.fn(),
  };
  const asService = service as unknown as IdentityVerificationsService;
  return {
    service,
    staff: new IdentityVerificationsStaffController(asService),
    customer: new IdentityVerificationsController(asService),
  };
}

const staffReq = { staff: { id: 'staff-1', email: 'lee.park@example.com' } } as never;
const playerReq = { player: { id: 'player-1' } } as never;

describe('IdentityVerificationsStaffController', () => {
  it('is behind the staff guard, which a customer session alone does not satisfy', () => {
    expect(guards(IdentityVerificationsStaffController)).toEqual([StaffGuard]);
  });

  it('lists pending by default and decided on request, never both', async () => {
    const { staff, service } = setup();
    await staff.list('decided');
    expect(service.listDecided).toHaveBeenCalledTimes(1);
    expect(service.listPending).not.toHaveBeenCalled();
    await staff.list(undefined);
    expect(service.listPending).toHaveBeenCalledTimes(1);
  });

  it('decides with the staff id from the session', async () => {
    const { staff, service } = setup();
    await staff.approve(staffReq, '7');
    expect(service.decide).toHaveBeenCalledWith('7', 'staff-1', { kind: 'approve' });
    await staff.reject(staffReq, '7', { reason: 'Bad ID' });
    expect(service.decide).toHaveBeenLastCalledWith('7', 'staff-1', { kind: 'reject', reason: 'Bad ID' });
  });

  it('answers 400 to a reject with no reason', async () => {
    const service = new IdentityVerificationsService({ pool: {} } as unknown as DatabaseService);
    const staff = new IdentityVerificationsStaffController(service);
    await expect(staff.reject(staffReq, '7', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers 404 for a malformed or unknown id', async () => {
    const { staff, service } = setup();
    service.get.mockResolvedValue(null);
    await expect(staff.one('abc')).rejects.toBeInstanceOf(NotFoundException);
    await expect(staff.one('7')).rejects.toBeInstanceOf(NotFoundException);
    expect(() => staff.approve(staffReq, '0')).toThrow(NotFoundException);
    expect(service.decide).not.toHaveBeenCalled();
  });
});

describe('IdentityVerificationsController', () => {
  it('is behind the session guard', () => {
    expect(guards(IdentityVerificationsController)).toEqual([SessionGuard]);
  });

  it('reports none for a customer who never submitted', async () => {
    const { customer, service } = setup();
    service.latestFor.mockResolvedValue(null);
    await expect(customer.status(playerReq)).resolves.toMatchObject({ status: 'none', rejectionReason: null });
    expect(service.latestFor).toHaveBeenCalledWith('player-1');
  });

  it('submits for the player in the session, ignoring any id in the body', async () => {
    const { customer, service } = setup();
    service.submit.mockResolvedValue({ status: 'pending', fullName: 'A', dateOfBirth: '1988-03-14', idNumber: 'X' });
    const body = { fullName: 'A', dateOfBirth: '1988-03-14', idNumber: 'X', playerId: 'other' };
    await customer.submit(playerReq, body);
    expect(service.submit).toHaveBeenCalledWith('player-1', {
      fullName: 'A',
      dateOfBirth: '1988-03-14',
      idNumber: 'X',
    });
  });
});
