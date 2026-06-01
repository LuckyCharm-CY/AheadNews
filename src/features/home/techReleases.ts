export type { TechReleaseCategory, TechRelease } from './types';

import type { TechRelease } from './types';
import { generatedTechReleases, techReleasesUpdatedAt } from './generatedTechReleases';

const fallbackTechReleases: TechRelease[] = [
  {
    id: 'gpt5-mini',
    name: 'GPT-5 Mini',
    category: 'AI / ML',
    description: 'Compact 4B-param model for edge devices. Runs fully offline.',
    domain: 'openai.com',
    initials: 'OA',
    iconBg: '#E6F1FB',
    releasedDate: '2025-04-24',
  },
  {
    id: 'android-16-dp3',
    name: 'Android 16 DP3',
    category: 'Mobile',
    description: 'Developer preview adds adaptive refresh rates and satellite SMS.',
    domain: 'android.com',
    initials: 'An',
    iconBg: '#EAF3DE',
    releasedDate: '2025-04-22',
  },
  {
    id: 'bun-2',
    name: 'Bun 2.0',
    category: 'Dev Tools',
    description: 'JavaScript runtime hits v2 with native SQL and 3× faster builds.',
    domain: 'bun.sh',
    initials: 'Bn',
    iconBg: '#FAEEDA',
    releasedDate: '2025-04-20',
  },
  {
    id: 'signal-desktop-7',
    name: 'Signal Desktop 7',
    category: 'Security',
    description: 'Major UI overhaul with Stories and cross-device usernames.',
    domain: 'signal.org',
    initials: 'Sg',
    iconBg: '#EEEDFE',
    releasedDate: '2025-04-18',
  },
];

export const techReleases: TechRelease[] =
  generatedTechReleases.length > 0 ? generatedTechReleases : fallbackTechReleases;

export const techReleasesLastUpdated =
  generatedTechReleases.length > 0 ? techReleasesUpdatedAt : '';
