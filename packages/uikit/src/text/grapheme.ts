const graphemeSegmenter =
  typeof Intl === 'undefined' ? undefined : new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function getNextGraphemeBreak(text: string, index: number): number {
  if (index >= text.length) {
    return text.length
  }

  const segments = graphemeSegmenter?.segment(text)
  const containing = segments?.containing(index)
  if (containing != null) {
    return containing.index + containing.segment.length
  }

  const codePoint = text.codePointAt(index)
  if (codePoint == null) {
    return index + 1
  }
  return index + (codePoint > 0xffff ? 2 : 1)
}

export function getGrapheme(text: string, index: number, nextIndex: number = getNextGraphemeBreak(text, index)) {
  return text.slice(index, nextIndex)
}