// Keep in sync with apps/web/src/lib/onboardingTemplates.ts and the checks in migrations/004_onboarding_templates.sql (pinned by onboarding-templates.service.spec.ts).
/** The latest due date: day 90 after the start date. There is no earliest limit. */
export const LATEST_DUE_DAY = 90;
export const TITLE_MAX = 200;

export const OWNERS = ['hiring_manager', 'it', 'new_hire', 'hr'] as const;
export type Owner = (typeof OWNERS)[number];

/** Job roles live in code until role management exists; `role` is the slug used in URLs and stored as job_role. */
export const JOB_ROLES = [
  { role: 'software-engineer', name: 'Software engineer' },
  { role: 'customer-support-agent', name: 'Customer support agent' },
  { role: 'account-manager', name: 'Account manager' },
] as const;
