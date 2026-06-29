'use client'

import Image from 'next/image'

import type { TimelineEvent } from '@/lib/timeline-data'
import { parseRichText } from '@/lib/parse-rich-text'
import { TimelineProjectCard } from '@/components/timeline-project-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TimelineEventContentProps = {
  event: TimelineEvent
}

function TimelineEventContent({ event }: TimelineEventContentProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h3 className="font-serif text-xl font-semibold text-[#4a5d54]">
          {parseRichText(event.heading)}
        </h3>
      </div>

      {event.content?.map((paragraph, index) => (
        <p
          key={`${event.id}-p${index}`}
          className="text-sm leading-relaxed text-[#5a6b62]"
        >
          {parseRichText(paragraph)}
        </p>
      ))}

      {event.images && event.images.length > 0 && (
        <div
          className={cn(
            'grid gap-3',
            event.images.length > 1
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1',
          )}
        >
          {event.images.map((image) => (
            <figure
              key={image.src}
              className="overflow-hidden rounded-[10px] border border-[#7a9e8e]/25"
            >
              <div className="relative aspect-4/3 w-full">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
              {image.credit && (
                <figcaption className="px-2 py-1.5 text-xs text-[#5a6b62]/80">
                  Credit: {image.credit}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {event.projects && event.projects.length > 0 && (
        <div className="space-y-4 pt-1">
          {event.projects.map((project) => (
            <TimelineProjectCard key={project.title} project={project} />
          ))}
        </div>
      )}

      {event.links && event.links.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {event.links.map((link) => (
            <Button
              key={link.href}
              variant="outline"
              size="sm"
              asChild
              className="border-[#7a9e8e]/40 bg-white/80 text-[#4a5d54] hover:bg-[#7a9e8e]/10 hover:text-[#4a5d54]"
            >
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

export { TimelineEventContent }
