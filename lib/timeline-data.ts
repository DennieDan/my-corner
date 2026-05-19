export type TimelineLink = {
  label: string
  href: string
}

export type TimelineImage = {
  src: string
  alt: string
  credit?: string
}

export type TimelineEvent = {
  id: string
  date: string
  dateTime: string
  tags?: string[]
  heading: string
  content?: string[]
  images?: TimelineImage[]
  links?: TimelineLink[]
}

export const TIMELINE_SECTION_TITLE =
  'JUST TRY YOUR BEST AND SEE WHAT YOU GET'

export const timelineEvents: TimelineEvent[] = [
  {
    id: '2020-01',
    date: 'January 2020',
    dateTime: '2020-01',
    tags: ['😐'],
    heading: 'Write first Python lines',
    content: [
      'At Le Hong Phong High School for the Gifted, I picked up my first programming language from an online course. But programming is not that special to me that time. It is attractive, but no intuitive.',
    ],
  },
  {
    id: '2022-08',
    date: 'August 2022',
    dateTime: '2022-08',
    tags: ['🙁', 'frontend'],
    heading: 'Pick up C and Frontend',
    content: [
      "At APTECH, I designed my first frontend static app using AngularJS and jQuery. I was very stressed, I didn't like it.",
    ],
    links: [
      {
        label: 'View Frontend',
        href: 'https://denniedan.github.io/Group2_T1.2208.M0_Eproject1/',
      },
      {
        label: 'GitHub Repo',
        href: 'https://github.com/DennieDan/Group2_T1.2208.M0_Eproject1',
      },
    ],
  },
  {
    id: '2022-10',
    date: 'October 2022',
    dateTime: '2022-10',
    heading:
      'Awarded **Women in Tech Scholarship** by RMIT University Vietnam',
    images: [
      {
        src: '/images/timeline/oct_2022.jpg',
        alt: 'Women in Tech Scholarship award ceremony',
      },
      {
        src: '/images/timeline/oct_2022_1.jpg',
        alt: 'Women in Tech Scholarship award',
      },
    ],
  },
  {
    id: '2022-12',
    date: 'December 2022',
    dateTime: '2022-12',
    tags: ['proud', 'disappointed', 'lost'],
    heading: 'Decide to Apply for NUS Computer Science',
    content: [
      'I was craving for a more challenging environment ... and I got what I wanted.',
      'Most of the time in my Year 1, I almost got Median. I found it difficult to understand content while peers did it easily.',
    ],
  },
  {
    id: '2024-06',
    date: 'June 2024',
    dateTime: '2024-06',
    tags: [
      '😎',
      'inline skating 🛼',
      'self-learn',
      'practice-practice-practice',
      'swimming',
    ],
    heading: 'Start a new hobby, out of CS,',
    content: [
      'It tooks me 2 weeks to self-learn to glide on my skates. I appreciate every step. The more I tried, the more I understood myself.',
      "I also picked up swimming as I stayed in Eusoff Hall. Just for fun. First time, I couldn't even finish 50m, I was almost drowned. I practised every week, leant from Youtube.",
      'I attended Inter-Hall Game and got 3rd prize.',
    ],
    images: [
      {
        src: '/images/timeline/jun_2024.jpg',
        alt: 'Inline skating and swimming hobbies',
      },
    ],
  },
  {
    id: '2024-12',
    date: 'December 2024',
    dateTime: '2024-12',
    tags: ['😍', 'A grades'],
    heading: 'My grades improved.',
    content: [
      "I got my first A's for Software Engineering and Database Systems.",
      'This time I fully know I got here. Not anyhow doing.',
    ],
  },
  {
    id: '2025-06',
    date: 'June 2025',
    dateTime: '2025-06',
    tags: ['😚', 'AI Agents'],
    heading: 'Work with AI Agents at Cyber Sierra',
    content: [
      'I did a 6-month internship at Cyber Sierra as Backend Engineer. I learned AI technologies and built workflow automation as well as agents',
    ],
    images: [
      {
        src: '/images/timeline/jun_2025.jpeg',
        alt: 'Internship at Cyber Sierra',
        credit: 'Cyber Sierra',
      },
    ],
    links: [
      {
        label: 'View my Data Analytics Chatbot',
        href: 'https://data-analyzer-ybzy.onrender.com/',
      },
      {
        label: 'GitHub Repo',
        href: 'https://dan-data-analyzer.streamlit.app/',
      },
    ],
  },
  {
    id: '2026-02',
    date: 'February 2026',
    dateTime: '2026-02',
    tags: ['hackathon'],
    heading: 'My first in-person hackthon: Hack & Roll',
    links: [
      {
        label: 'View LinkedIn post',
        href: 'https://www.linkedin.com/posts/dandinh-dennie_7-am-day-2-of-hackroll-my-first-in-person-ugcPost-7418866354688012289-SWSY?utm_source=social_share_send&utm_medium=member_desktop_web&rcm=ACoAAD0L-eUB3JSPZpSqpGAqMvjfIAL3L_GKjho',
      },
    ],
  },
  {
    id: '2026-03',
    date: 'March 2026',
    dateTime: '2026-03',
    tags: ['😘', 'RAG', 'love it'],
    heading: 'Build a RAG agent',
    content: [
      'The agent classifies an input item to corresponding Harmonized System Codes (HS-Code), based on the _Singapore Trade Classification, Customs, and Excise Duties 2022_',
    ],
    links: [
      {
        label: 'View app',
        href: 'https://classifier-agent.onrender.com/ui/',
      },
      {
        label: 'GitHub Repo',
        href: 'https://github.com/DennieDan/classifier-agent',
      },
    ],
  },
  {
    id: '2026-06',
    date: 'June 2026',
    dateTime: '2026-06',
    tags: ['passionate', 'infrastructure'],
    heading: 'Learn AWS Infrastructure',
  },
]
