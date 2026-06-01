export type HomeStory = {
  id: string;
  headline: string;
  summary: string;
  quickSummary?: string;
  whyItMatters: string;
  source: string;
  imageUrl?: string;
  articleUrl?: string;
};

export type TechReleaseCategory =
  | 'AI / ML'
  | 'Mobile'
  | 'Dev Tools'
  | 'Security'
  | 'Hardware'
  | 'Web';

export interface TechRelease {
  id: string;
  name: string;
  category: TechReleaseCategory;
  description: string;
  domain: string;
  initials: string;
  iconBg: string;
  releasedDate: string;
  url?: string;
}

export type FundingStage =
  | 'Pre-Seed'
  | 'Seed'
  | 'Series A'
  | 'Series B'
  | 'Series C+';

export interface NewStartup {
  id: string;
  name: string;
  domain: string;
  initials: string;
  avatarColor: string;
  stage: FundingStage;
  sector: string;
  description: string;
  raisedAmount: string;
  foundedYear: number;
  url?: string;
}
