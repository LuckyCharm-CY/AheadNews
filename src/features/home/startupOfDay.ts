import { generatedStartupOfDay, startupOfDayUpdatedAt } from './generatedStartupOfDay';

export { startupOfDayUpdatedAt };

const fallbackStartupOfDay = {
  id: 'startup-of-day',
  name: 'PacePilot',
  oneLiner: 'Workflow intelligence for teams handling regulated operations.',
  foundedYear: '2021',
  problemSolved: 'Slow, manual compliance and documentation cycles across finance and legal teams.',
  imageUrl: 'https://picsum.photos/seed/startup-of-day/1400/900',
  storyTitle: 'Startup of the Day: PacePilot',
  storyParagraphs: [
    'PacePilot started as an internal tooling project inside a compliance consultancy before it spun out into an independent startup. The founding team saw the same pattern repeatedly: talented teams losing hours each week to repetitive policy checks and fragmented documentation handoffs.',
    'The product focuses on structured workflow automation for regulated industries. It does not attempt to replace human review; instead, it prepares clean drafts, flags missing evidence, and gives teams a clear audit trail before final sign-off.',
    'What makes PacePilot notable is timing. As more companies adopt AI-assisted tooling, the winners may be products that reduce process friction in high-trust environments rather than consumer novelty use cases. PacePilot is aiming directly at that gap.',
  ] as [string, string, string],
};

export const startupOfDay = generatedStartupOfDay ?? fallbackStartupOfDay;
