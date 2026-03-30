const graphemeSegmenter =
  typeof Intl === 'undefined' ? undefined : new Intl.Segmenter(undefined, { granularity: 'grapheme' })

const maxCachedTexts = 4
const graphemeBreakCache = new Map<string, Uint32Array>()

export function getNextGraphemeBreak(text: string, index: number): number {
  if (index >= text.length) {
    return text.length
  }

  return getCachedNextBreaks(text)[index]!
}

export function getGrapheme(text: string, index: number, nextIndex: number = getNextGraphemeBreak(text, index)) {
  return text.slice(index, nextIndex)
}

function getCachedNextBreaks(text: string): Uint32Array {
  const cached = graphemeBreakCache.get(text)
  if (cached != null) {
    // refresh LRU position
    graphemeBreakCache.delete(text)
    graphemeBreakCache.set(text, cached)
    return cached
  }

  const nextBreaks = buildNextBreaks(text)
  graphemeBreakCache.set(text, nextBreaks)
  if (graphemeBreakCache.size > maxCachedTexts) {
    const firstKey = graphemeBreakCache.keys().next().value
    if (firstKey != null) {
      graphemeBreakCache.delete(firstKey)
    }
  }
  return nextBreaks
}

function buildNextBreaks(text: string): Uint32Array {
  const nextBreaks = new Uint32Array(text.length + 1)
  nextBreaks[text.length] = text.length

  if (graphemeSegmenter != null) {
    const segments = graphemeSegmenter.segment(text)
    for (const { index, segment } of segments) {
      const nextIndex = index + segment.length
      for (let i = index; i < nextIndex; i++) {
        nextBreaks[i] = nextIndex
      }
    }
    return nextBreaks
  }

  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i)
    const nextIndex = i + (codePoint != null && codePoint > 0xffff ? 2 : 1)
    for (let ii = i; ii < nextIndex; ii++) {
      nextBreaks[ii] = nextIndex
    }
    i = nextIndex
  }

  return nextBreaks
}
