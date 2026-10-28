import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** scrypt with a per-password random salt; stored as `salt:key`, both hex. */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await derive(password, salt);
    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }

  async verify(stored: string, password: string): Promise<boolean> {
    const [saltHex, keyHex] = stored.split(':');
    if (!saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, 'hex');
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await derive(password, Buffer.from(saltHex, 'hex'));
    return timingSafeEqual(actual, expected);
  }
}
