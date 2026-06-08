export type { TechReleaseCategory, TechRelease } from './types';

import { generatedTechReleases, techReleasesUpdatedAt } from './generatedTechReleases';

export const techReleases = generatedTechReleases;
export const techReleasesLastUpdated = techReleasesUpdatedAt;
