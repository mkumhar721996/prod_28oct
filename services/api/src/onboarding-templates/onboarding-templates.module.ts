import { Module } from '@nestjs/common';
import { HrGuard } from '../session/hr.guard';
import { SessionModule } from '../session/session.module';
import { OnboardingTemplatesController } from './onboarding-templates.controller';
import { OnboardingTemplatesService } from './onboarding-templates.service';

@Module({
  imports: [SessionModule],
  controllers: [OnboardingTemplatesController],
  providers: [OnboardingTemplatesService, HrGuard],
})
export class OnboardingTemplatesModule {}
