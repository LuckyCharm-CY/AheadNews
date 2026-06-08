export type { FundingStage, NewStartup } from './types';

import { generatedNewStartups, newStartupsUpdatedAt } from './generatedNewStartups';

export const newStartups = generatedNewStartups;
export const newStartupsLastUpdated = newStartupsUpdatedAt;
