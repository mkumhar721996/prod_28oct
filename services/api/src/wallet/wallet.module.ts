import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [SessionModule],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
