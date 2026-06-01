import type { Comment, Post } from './types';

const T = (hoursAgo: number) =>
  new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

export const SEED_POSTS: Post[] = [
  {
    authorId: '', id: 'p0',
    title: '📌 Welcome to the Community Forum — Rules & Guidelines',
    content:
      'Welcome to the AheadNews Community Forum! This is a space for thoughtful discussion of world events, sharing perspectives, and connecting with other readers. \n\nRules: (1) Be respectful — disagree with ideas, not people. (2) No misinformation — cite sources where possible. (3) Keep threads on-topic. (4) No spam or self-promotion. Moderators reserve the right to remove posts that violate these guidelines.',
    category: 'Announcements',
    author: 'AheadNews_Mod',
    authorBadge: 'mod',
    createdAt: T(52),
    votes: 312,
    commentCount: 8,
    isStickied: true,
  },
  {
    authorId: '', id: 'p1',
    title: 'US and China are building completely different AI ecosystems — what does this mean for the rest of us?',
    content:
      "Just read the Washington Post opinion piece on how America and China are diverging on AI. The divergence is striking: US models optimise for reasoning and general capability, Chinese models optimise for regulatory compliance and state objectives. If the two ecosystems become incompatible at the API/tooling level, developers will have to pick a side. What's your take — is this inevitable, or is there a middle path?",
    category: 'Tech & AI',
    author: 'techwatch_sg',
    createdAt: T(5),
    votes: 127,
    commentCount: 43,
  },
  {
    authorId: '', id: 'p2',
    title: 'Singapore in the middle of the US-China tariff crossfire — how worried should we be?',
    content:
      "Singapore's position as a trade hub makes it uniquely exposed to any prolonged trade war. With both the US and China as major trading partners, MAS has been unusually vocal this quarter about tail risks. The government's pivot toward domestic consumption and regional diversification feels like a hedge — but is it enough? Curious what people in finance and trade think.",
    category: 'Local SG News',
    author: 'sg_economist',
    authorBadge: 'verified',
    createdAt: T(8),
    votes: 94,
    commentCount: 28,
  },
  {
    authorId: '', id: 'p3',
    title: 'OpenAI vs Anthropic vs Google — which AI company actually has a sustainable business model?',
    content:
      "After the Google-Pentagon AI deal and OpenAI's latest funding round at a $300B+ valuation, I keep wondering which of these companies will be profitable at scale. The compute costs are insane and commoditisation is happening fast. OpenAI is betting on the platform + API layer, Anthropic on enterprise safety contracts, Google on integration with existing products. Who survives the next 3 years?",
    category: 'Business',
    author: 'startup_radar',
    createdAt: T(12),
    votes: 89,
    commentCount: 61,
  },
  {
    authorId: '', id: 'p4',
    title: 'EU AI Act enforcement is starting — which companies are most exposed and what should Singapore firms know?',
    content:
      "The first real enforcement actions under the EU AI Act are expected this quarter. High-risk AI systems now require conformity assessments and human oversight documentation. Companies with EU customers or EU-based subsidiaries are in scope even if headquartered elsewhere. I've been tracking disclosures — surprisingly few companies outside Europe have published compliance plans.",
    category: 'World News',
    author: 'policy_lens',
    authorBadge: 'verified',
    createdAt: T(19),
    votes: 76,
    commentCount: 19,
  },
  {
    authorId: '', id: 'p5',
    title: 'ChatGPT vs Claude for daily use — a real comparison after 3 months',
    content:
      "I switched from ChatGPT to Claude 4 months ago and have been keeping notes. Verdict: Claude is better at nuanced writing and reasoning through ambiguous problems. ChatGPT is better at quick tasks, code generation, and has more plugins. Claude's context window handling is superior for long documents. Neither is clearly better — it depends on your use case. Happy to share specific comparisons if useful.",
    category: 'Tech & AI',
    author: 'ai_daily_user',
    createdAt: T(27),
    votes: 68,
    commentCount: 55,
  },
  {
    authorId: '', id: 'p6',
    title: "Singapore HDB resale prices — is the market finally cooling or just a blip?",
    content:
      "Q1 2026 HDB resale data is out. Prices up 1.2% QoQ, down from 3.1% a year ago. Cash-over-valuation for popular estates is still high but there are signs of softening in the OCR. For those who've been waiting — is this the signal to buy, or do you expect further correction? Interest rates and the upcoming BTO supply pipeline seem like the key variables.",
    category: 'Local SG News',
    author: 'prop_watcher',
    createdAt: T(34),
    votes: 102,
    commentCount: 47,
  },
  {
    authorId: '', id: 'p7',
    title: 'Is ESG investing just greenwashing at scale? A sceptic\'s take',
    content:
      "I manage a small portfolio and have been questioning ESG ratings after reading about the methodology behind them. Different rating agencies give the same company wildly different scores. Tesla scores low on governance but high on environment; Exxon scores high on governance. The whole system seems designed to let fund managers charge higher fees while delivering... what exactly? Interested in pushback from ESG believers.",
    category: 'Business',
    author: 'value_investor_sg',
    createdAt: T(40),
    votes: 58,
    commentCount: 33,
  },
  {
    authorId: '', id: 'p8',
    title: 'World Cup 2026 — which teams are you backing and why?',
    content:
      "With the expanded 48-team format and three host nations, this is shaping up to be a very different tournament. Group stage dilution is real but the round-of-32 knockout stage should be electric. My picks: Brazil to finally end the drought, England to exit on penalties as tradition demands, and a dark horse from CONCACAF in the semis given home advantage.",
    category: 'Sports',
    author: 'football_sg',
    createdAt: T(45),
    votes: 134,
    commentCount: 78,
  },
  {
    authorId: '', id: 'p9',
    title: 'How do you stay properly informed without the anxiety spiral?',
    content:
      "I've been trying to cut passive doom-scrolling and be more intentional about news. Currently: 20 mins with AheadNews in the morning, one longer read on weekends, and I've muted all news notifications. My anxiety about world events has dropped noticeably. Curious what others do — especially for people in high-stakes jobs where staying current actually matters.",
    category: 'Life',
    author: 'mindful_reader',
    createdAt: T(50),
    votes: 118,
    commentCount: 52,
  },
];

export const SEED_COMMENTS: Record<string, Comment[]> = {
  p0: [
    {
      id: 'c00', author: 'new_member_2026', authorBadge: undefined,
      content: 'Happy to be here! Looking forward to more thoughtful discussions than what you get on X these days.',
      createdAt: T(50), votes: 45, replies: [],
    },
    {
      id: 'c01', author: 'longtime_reader', authorBadge: undefined,
      content: 'Rule 1 is the important one. News discussions get toxic fast when people attack the person instead of the argument.',
      createdAt: T(49), votes: 67, replies: [
        { id: 'c01r0', author: 'AheadNews_Mod', content: 'Exactly — we want this to feel like a good dinner conversation, not a comment section.', createdAt: T(48), votes: 38 },
      ],
    },
    {
      id: 'c02', author: 'global_citizen', authorBadge: undefined,
      content: 'Will there be dedicated threads for breaking news or is everything free-form?',
      createdAt: T(46), votes: 22, replies: [
        { id: 'c02r0', author: 'AheadNews_Mod', content: 'We pin breaking news megathreads when events develop quickly — keeps the discussion consolidated.', createdAt: T(45), votes: 31 },
      ],
    },
  ],
  p1: [
    {
      id: 'c10', author: 'globaltech_analyst', authorBadge: undefined,
      content: 'The key issue is API compatibility. If Chinese and American models use incompatible tool-calling formats, developers will have to maintain two separate codebases. That\'s where the real split happens.',
      createdAt: T(4), votes: 38, replies: [
        { id: 'c10r0', author: 'techwatch_sg', content: 'Exactly. The MCP protocol from Anthropic is gaining traction in the US/EU, but Baidu and Alibaba are pushing their own standards.', createdAt: T(3.5), votes: 21 },
        { id: 'c10r1', author: 'AheadNews_Mod', content: 'Great thread. Pinning for visibility — worth exploring the open-source angle too since Qwen and Llama sit outside either ecosystem.', createdAt: T(3), votes: 15 },
      ],
    },
    {
      id: 'c11', author: 'southeast_dev', authorBadge: undefined,
      content: 'As a developer in SEA, this is already real. AWS Bedrock vs Alibaba Cloud AI for enterprise clients is a political decision as much as a technical one. Some clients explicitly ask which data centre jurisdiction their prompts go through.',
      createdAt: T(3.8), votes: 55, replies: [
        { id: 'c11r0', author: 'cloud_arch_sg', content: 'Data residency requirements are going to force this anyway. PDPA compliance in SG already limits where personal data can be processed.', createdAt: T(3.2), votes: 29 },
      ],
    },
    {
      id: 'c12', author: 'realist_99', authorBadge: undefined,
      content: 'Slightly cynical take: this divergence has been happening with the internet for 15 years (Great Firewall, different app stores, etc). AI is just the next layer. Most companies build for both and quietly choose which features to enable in which markets.',
      createdAt: T(3.5), votes: 44, replies: [],
    },
  ],
  p3: [
    {
      id: 'c30', author: 'vc_perspective', authorBadge: undefined,
      content: 'OpenAI has the consumer brand advantage but it\'s a liability too — everyone benchmarks against them. Anthropic\'s enterprise-focused strategy with Constitutional AI gives them a defensible moat in regulated industries.',
      createdAt: T(11), votes: 48, replies: [
        { id: 'c30r0', author: 'startup_radar', content: 'The regulated industries angle is real. Healthcare and legal are willing to pay 5x for AI they can explain to a regulator.', createdAt: T(10), votes: 32 },
      ],
    },
    {
      id: 'c31', author: 'ex_big_tech', authorBadge: undefined,
      content: 'Google wins by default if this becomes infrastructure. They have the compute, the distribution, and the cash to outlast everyone. The question is whether Gemini ever becomes the default choice rather than an afterthought.',
      createdAt: T(10.5), votes: 61, replies: [],
    },
    {
      id: 'c32', author: 'sg_fintech', authorBadge: undefined,
      content: 'The real winner might be whoever gets to the financial services industry first with a genuinely compliant product. That TAM dwarfs consumer AI.',
      createdAt: T(9), votes: 37, replies: [
        { id: 'c32r0', author: 'policy_lens', content: 'Bloomberg and Refinitiv are already positioning their own LLMs for this. The incumbents won\'t cede that ground easily.', createdAt: T(8.5), votes: 19 },
      ],
    },
  ],
  p7: [
    {
      id: 'c70', author: 'esg_practitioner', authorBadge: undefined,
      content: 'You\'re right that the ratings are inconsistent but I\'d separate the concept from the execution. The underlying idea — that externalities should be priced into investment decisions — is sound. The problem is we let marketing capture the term before the methodology was rigorous.',
      createdAt: T(39), votes: 41, replies: [
        { id: 'c70r0', author: 'value_investor_sg', content: 'Fair point. I\'m sceptical of the product, not the goal. There\'s a version of this that could work with standardised, audited disclosures.', createdAt: T(38), votes: 28 },
      ],
    },
    {
      id: 'c71', author: 'index_funds_only', authorBadge: undefined,
      content: 'ESG ETF expense ratios average 0.15% higher than equivalent non-ESG ETFs. Over 30 years that compounds to meaningful underperformance. The burden of proof is on ESG advocates to show the returns justify the fees.',
      createdAt: T(38.5), votes: 52, replies: [],
    },
  ],
  p8: [
    {
      id: 'c80', author: 'group_of_death_fan', authorBadge: undefined,
      content: 'Brazil hasn\'t won since 2002. Every cycle everyone says "this is the year". At some point the squad needs a generational reset rather than just another attempt with Vini Jr carrying the load.',
      createdAt: T(44), votes: 63, replies: [
        { id: 'c80r0', author: 'football_sg', content: 'Vini Jr + Rodrygo + Endrick is actually a better front three than 2002\'s supporting cast around Ronaldo though.', createdAt: T(43), votes: 34 },
        { id: 'c80r1', author: 'tactics_nerd', content: 'The midfield is the question. Who\'s the Gilberto Silva?', createdAt: T(42.5), votes: 21 },
      ],
    },
    {
      id: 'c81', author: 'usa_believer', authorBadge: undefined,
      content: 'Co-hosting in North America changes things drastically. USMNT with home crowds at MetLife Stadium and Rose Bowl could genuinely get to the semis. The squad has quietly become top 10 in the world.',
      createdAt: T(43.5), votes: 47, replies: [],
    },
  ],
  p9: [
    {
      id: 'c90', author: 'former_journalist', authorBadge: undefined,
      content: 'I worked in news for 10 years and now deliberately consume less of it. The irony isn\'t lost on me. Turning off notifications was the single biggest change — the algorithm-driven urgency is designed, not natural.',
      createdAt: T(49), votes: 89, replies: [
        { id: 'c90r0', author: 'mindful_reader', content: 'The "urgency" framing is so accurate. Nothing in my notification tray has ever actually required my immediate attention.', createdAt: T(48), votes: 52 },
      ],
    },
    {
      id: 'c91', author: 'news_researcher', authorBadge: undefined,
      content: 'There\'s decent research showing that people who consume news to "stay informed" often know less than people who read one curated source weekly. More volume ≠ more understanding.',
      createdAt: T(48.5), votes: 74, replies: [],
    },
    {
      id: 'c92', author: 'pragmatic_sg', authorBadge: undefined,
      content: 'Morning briefing apps like this one are genuinely useful for exactly this reason — one place, curated, done. I think the next frontier is AI that filters to only what\'s relevant to your work/life.',
      createdAt: T(47), votes: 45, replies: [],
    },
  ],
};
