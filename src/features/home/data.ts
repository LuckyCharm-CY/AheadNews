import type { HomeStory } from './types';
import { generatedStories, generatedStoriesUpdatedAt } from './generatedStories';

export const placeholderStories: HomeStory[] = [
  {
    id: '1',
    headline: 'Open models narrow the enterprise performance gap',
    summary:
      'A new benchmark round shows open-source AI models matching premium tools in coding and data tasks for many business use cases.',
    quickSummary: 'Open AI models are catching up to premium tools, which may lower costs for more companies to adopt AI.',
    whyItMatters:
      'Lower model costs could accelerate AI adoption in small and mid-sized companies.',
    source: 'VentureBeat',
    imageUrl: 'https://picsum.photos/seed/aheadnews-1/1200/700',
    articleUrl: 'https://venturebeat.com/ai/',
  },
  {
    id: '2',
    headline: 'AI chips shift toward lower-power edge workloads',
    summary:
      'Hardware makers are launching efficient AI chips focused on running assistants on-device rather than sending every request to the cloud.',
    quickSummary: 'More AI workloads are moving on-device, which can improve speed and privacy for users.',
    whyItMatters:
      'On-device AI may improve privacy and unlock faster everyday experiences.',
    source: 'The Verge',
    imageUrl: 'https://picsum.photos/seed/aheadnews-2/1200/700',
    articleUrl: 'https://www.theverge.com/ai-artificial-intelligence',
  },
  {
    id: '3',
    headline: 'EU outlines updated guidance for AI transparency',
    summary:
      'Policy guidance clarifies documentation expectations for model providers and app builders deploying high-impact AI systems in Europe.',
    quickSummary: 'EU AI guidance is getting clearer, helping teams plan compliance with less legal uncertainty.',
    whyItMatters:
      'Clear compliance rules can reduce launch risk for startups building AI products.',
    source: 'Reuters',
    imageUrl: 'https://picsum.photos/seed/aheadnews-3/1200/700',
    articleUrl: 'https://www.reuters.com/technology/artificial-intelligence/',
  },
  {
    id: '4',
    headline: 'Researchers cut inference costs with routing methods',
    summary:
      'A research team proposes a routing architecture that activates only small parts of a model, reducing compute while keeping output quality strong.',
    quickSummary: 'A smarter model-routing approach could reduce AI compute costs without hurting quality.',
    whyItMatters:
      'Cheaper inference could make advanced AI tools more accessible globally.',
    source: 'Hugging Face Blog',
    imageUrl: 'https://picsum.photos/seed/aheadnews-4/1200/700',
    articleUrl: 'https://huggingface.co/blog',
  },
  {
    id: '5',
    headline: 'AI startup automates regulatory filing workflows',
    summary:
      'A fast-growing startup raised fresh funding after showing legal and finance teams faster document preparation and fewer manual review cycles.',
    quickSummary: 'AI automation in regulated workflows is gaining traction and may drive big productivity gains.',
    whyItMatters:
      'Automation in regulated work may become a major driver of AI productivity gains.',
    source: 'TechCrunch',
    imageUrl: 'https://picsum.photos/seed/aheadnews-5/1200/700',
    articleUrl: 'https://techcrunch.com/category/artificial-intelligence/',
  },
];

export const homeStories: HomeStory[] = generatedStories.length > 0 ? generatedStories : placeholderStories;
export const homeStoriesUpdatedAt = generatedStories.length > 0 ? generatedStoriesUpdatedAt : '';
