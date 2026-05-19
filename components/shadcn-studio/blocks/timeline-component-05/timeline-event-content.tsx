'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'

import type { TimelineEvent } from '@/lib/timeline-data'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function parseInlineText(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|_[^_]+_)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-[#4a5d54]">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      parts.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>,
      )
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

type TimelineEventContentProps = {
  event: TimelineEvent
}

function TimelineEventContent({ event }: TimelineEventContentProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h3 className="font-serif text-xl font-semibold text-[#4a5d54]">
          {parseInlineText(event.heading)}
        </h3>
      </div>

      {event.content?.map((paragraph, index) => (
        <p
          key={`${event.id}-p${index}`}
          className="text-sm leading-relaxed text-[#5a6b62]"
        >
          {parseInlineText(paragraph)}
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

export { TimelineEventContent, parseInlineText }
