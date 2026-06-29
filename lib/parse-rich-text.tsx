import type { ReactNode } from 'react'

const INLINE_TOKEN_REGEX =
  /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g

function parseInlineSegment(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = INLINE_TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `${keyPrefix}-${match.index}`

    if (token.startsWith('**')) {
      parts.push(
        <strong key={key} className="font-semibold text-[#4a5d54]">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('_')) {
      parts.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      )
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        parts.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#527063] underline decoration-[#7a9e8e]/50 underline-offset-2 hover:text-[#4a5d54]"
          >
            {linkMatch[1]}
          </a>,
        )
      } else {
        parts.push(token)
      }
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

function parseRichText(text: string): ReactNode[] {
  return parseInlineSegment(text, 'rich')
}

export { parseRichText, parseInlineSegment }
