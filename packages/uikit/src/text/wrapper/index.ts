import type { GlyphLayoutLine, GlyphOutProperties } from '../layout.js'
import { getGrapheme, getNextGraphemeBreak } from '../grapheme.js'

export type GlyphWrapper = (
  properties: GlyphOutProperties,
  availableWidth: number | undefined,
  textStartIndex: number,
  target: GlyphLayoutLine,
) => void

export function skipWhitespace(text: string, index: number): number {
  const textLength = text.length
  while (index < textLength) {
    const nextIndex = getNextGraphemeBreak(text, index)
    if (getGrapheme(text, index, nextIndex) !== ' ') {
      break
    }
    index = nextIndex
  }
  return index
}

export * from './breakall-wrapper.js'
export * from './nowrap-wrapper.js'
export * from './word-wrapper.js'
