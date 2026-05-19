'use client'

import ChangelogContent, {
  type Release,
} from '@/components/shadcn-studio/blocks/timeline-component-05/timeline-component-05'
import { TimelineEventContent } from '@/components/shadcn-studio/blocks/timeline-component-05/timeline-event-content'
import {
  TIMELINE_SECTION_TITLE,
  timelineEvents,
} from '@/lib/timeline-data'

const releases: Release[] = timelineEvents.map((event) => ({
  version: event.date,
  tags: event.tags,
  content: <TimelineEventContent key={event.id} event={event} />,
}))

export function JourneyTimeline() {
  return (
    <section aria-labelledby="journey-timeline-heading">
      <ChangelogContent
        releases={releases}
        title={TIMELINE_SECTION_TITLE}
        description=""
        headingId="journey-timeline-heading"
        titleClassName="font-mono text-sm font-normal tracking-[0.25em] text-[#5a6b62] uppercase md:text-base"
        showHeader
      />
    </section>
  )
}
