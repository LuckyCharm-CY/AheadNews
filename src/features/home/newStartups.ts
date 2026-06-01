export type { FundingStage, NewStartup } from './types';

import type { NewStartup } from './types';
import { generatedNewStartups, newStartupsUpdatedAt } from './generatedNewStartups';

const fallbackNewStartups: NewStartup[] = [
  {
    id: 'nervos-health',
    name: 'Nervos Health',
    domain: 'nervoshealth.com',
    initials: 'Nv',
    avatarColor: '#378ADD',
    stage: 'Seed',
    sector: 'Healthcare AI',
    description:
      'Monitors chronic pain via wearable sensors and adjusts medication reminders in real-time using AI.',
    raisedAmount: '$4.2M',
    foundedYear: 2024,
  },
  {
    id: 'fuze-logistics',
    name: 'Fuze Logistics',
    domain: 'fuzelogistics.com',
    initials: 'Fz',
    avatarColor: '#1D9E75',
    stage: 'Pre-Seed',
    sector: 'Supply Chain',
    description:
      'Real-time port congestion intelligence for SME importers, powered by satellite data.',
    raisedAmount: '$1.8M',
    foundedYear: 2024,
  },
  {
    id: 'crux-legal',
    name: 'Crux Legal',
    domain: 'cruxlegal.com',
    initials: 'Cr',
    avatarColor: '#7F77DD',
    stage: 'Series A',
    sector: 'LegalTech',
    description:
      'AI contract review that flags risky clauses in under 30 seconds for small businesses.',
    raisedAmount: '$11M',
    foundedYear: 2023,
  },
];

export const newStartups: NewStartup[] =
  generatedNewStartups.length > 0 ? generatedNewStartups : fallbackNewStartups;

export const newStartupsLastUpdated =
  generatedNewStartups.length > 0 ? newStartupsUpdatedAt : '';
