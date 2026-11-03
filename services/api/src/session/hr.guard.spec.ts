import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { HrGuard } from './hr.guard';

const contextFor = (player: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ player }) }) }) as unknown as ExecutionContext;

describe('HrGuard', () => {
  const guard = new HrGuard();

  it('lets an HR account through', () => {
    expect(guard.canActivate(contextFor({ accountRole: 'hr' }))).toBe(true);
  });

  it('refuses a player with 403', () => {
    expect(() => guard.canActivate(contextFor({ accountRole: 'player' }))).toThrow(
      ForbiddenException,
    );
  });
});
