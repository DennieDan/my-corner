'use client'

import { useState } from 'react'

import { Copy, Check } from 'lucide-react'

type CopyCodeProps = {
  code: string
  language?: string
}

function CopyCode({ code = 'javascript' }: CopyCodeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } else {
        const textArea = document.createElement('textarea')

        textArea.value = code
        textArea.style.position = 'absolute'
        textArea.style.left = '-999999px'
        document.body.prepend(textArea)
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch (err) {
      console.error('Failed to copy', err)
      alert('Failed to copy code to clipboard')
    }
  }

  const highlightCode = (code: string) => {
    let result = code

    result = result.replace(
      /"([^"]*)"/g,
      '<span class="text-blue-600 dark:text-blue-400">"$1"</span>',
    )
    result = result.replace(
      /\b(agent)\b/g,
      '<span class="text-blue-600 dark:text-blue-400">$1</span>',
    )

    result = result.replace(
      /\b(const|let|var|new|false)\b/g,
      '<span class="text-red-600 dark:text-red-400">$1</span>',
    )

    result = result.replace(
      /\b(AIAgent|true)\b/g,
      '<span class="text-green-600 dark:text-green-400">$1</span>',
    )

    result = result.replace(
      /\/\/ ([^\n]*)/g,
      '<span class="text-gray-500 dark:text-gray-400">// $1</span>',
    )

    return result
  }

  return (
    <div
      className="bg-muted relative rounded-[14px] p-2.5"
      style={{ fontFamily: "'Fira Code', monospace" }}
    >
      <div className="relative rounded-[10px] bg-white px-3.5 py-2.5 text-xs dark:bg-black">
        <pre className="overflow-x-auto">
          <code dangerouslySetInnerHTML={{ __html: highlightCode(code) }} />
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="bg-muted absolute end-0 bottom-0 rounded-md p-1.5 transition-colors"
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  )
}

export { CopyCode }
