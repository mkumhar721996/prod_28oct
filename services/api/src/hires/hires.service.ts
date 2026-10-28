import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DUPLICATE_EMAIL_MESSAGE, parseCreateHire } from './dto/create-hire.dto';
import { HIRES_REPOSITORY, Hire, HiresRepository } from './hires.repository';
import { INVITE_PORT, InvitePort } from './invite.port';

@Injectable()
export class HiresService {
  constructor(
    @Inject(HIRES_REPOSITORY) private readonly repo: HiresRepository,
    @Inject(INVITE_PORT) private readonly invites: InvitePort,
  ) {}

  findAll(): Hire[] {
    return this.repo.findAll();
  }

  /**
   * Order is fixed: validate (400), duplicate (409), store, then invite (502 rolls the hire back).
   * Everything up to the invite is synchronous so concurrent duplicates cannot both pass.
   */
  create(input: unknown): Promise<Hire> {
    const parsed = parseCreateHire(input);
    if (parsed.errors) throw new BadRequestException({ errors: parsed.errors });
    const { dto } = parsed;
    if (this.repo.findByEmail(dto.email)) {
      throw new ConflictException({ errors: { email: DUPLICATE_EMAIL_MESSAGE } });
    }
    const hire: Hire = { id: randomUUID(), ...dto, status: 'invited' };
    this.repo.insert(hire);
    return this.invite(hire);
  }

  private async invite(hire: Hire): Promise<Hire> {
    try {
      await this.invites.send({ hireId: hire.id, name: hire.name, email: hire.email });
    } catch {
      this.repo.remove(hire.id);
      throw new BadGatewayException({ errors: {}, message: 'The invite could not be sent.' });
    }
    return hire;
  }
}
