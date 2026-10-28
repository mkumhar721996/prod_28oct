import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('verifies the password it hashed', async () => {
    const hash = await service.hash('play-2026');
    expect(await service.verify(hash, 'play-2026')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('play-2026');
    expect(await service.verify(hash, 'wrong-wrong')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await service.hash('play-2026')).not.toBe(await service.hash('play-2026'));
  });

  it('rejects a malformed hash', async () => {
    expect(await service.verify('garbage', 'play-2026')).toBe(false);
  });
});
