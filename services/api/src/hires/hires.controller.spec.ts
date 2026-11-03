import { ExecutionContext } from '@nestjs/common';
import { HrGuard } from '../session/hr.guard';
import { HiresController } from './hires.controller';
import { HiresService } from './hires.service';

function setup(createPlan: unknown) {
  const service = {
    createPlan: jest.fn(async () => createPlan),
    getHire: jest.fn(async () => ({ roleName: 'Account manager' })),
    getPlan: jest.fn(async () => null),
  };
  return new HiresController(service as unknown as HiresService);
}

describe('HiresController.createPlan', () => {
  it('returns the plan id on success', async () => {
    expect(await setup({ ok: true, planId: 'plan-1' }).createPlan('hire-1')).toEqual({ planId: 'plan-1' });
  });

  it('refuses a hire with no manager with a plain message (AC7)', async () => {
    await expect(setup({ ok: false, code: 'no_manager' }).createPlan('hire-1')).rejects.toMatchObject({
      response: { code: 'no_manager', message: expect.stringContaining('this hire has no manager') },
      status: 422,
    });
  });

  it('refuses a role with no template and names the role (AC8)', async () => {
    await expect(setup({ ok: false, code: 'no_template' }).createPlan('hire-2')).rejects.toMatchObject({
      response: {
        code: 'no_template',
        message:
          'Plan not created: the Account manager role has no onboarding template. Create the template first, then try again.',
      },
      status: 422,
    });
  });

  it('answers 409 when the hire already has a plan', async () => {
    await expect(setup({ ok: false, code: 'plan_exists' }).createPlan('hire-1')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('answers 404 for an unknown hire, and when there is no plan', async () => {
    await expect(setup({ ok: false, code: 'hire_not_found' }).createPlan('x')).rejects.toMatchObject({ status: 404 });
    await expect(setup(null).plan('x')).rejects.toMatchObject({ status: 404 });
  });
});

describe('HiresController guards', () => {
  const contextFor = (accountRole: string) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ player: { accountRole } }) }) }) as unknown as ExecutionContext;

  it('refuses a non-HR player on plan creation (403)', () => {
    expect(() => new HrGuard().canActivate(contextFor('player'))).toThrow(expect.objectContaining({ status: 403 }));
    expect(new HrGuard().canActivate(contextFor('hr'))).toBe(true);
  });

  it('puts the HR guard on the whole controller', () => {
    const guards = Reflect.getMetadata('__guards__', HiresController) as unknown[];
    expect(guards).toContain(HrGuard);
  });
});
