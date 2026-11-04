export const ROLES = ['super_admin', 'staff', 'fundraising_consultant'] as const;
export type Role = (typeof ROLES)[number];
