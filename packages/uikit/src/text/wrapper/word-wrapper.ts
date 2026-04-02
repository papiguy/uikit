import { getOffsetToNextGlyph } from '../utils.js'
import { getGrapheme, getNextGraphemeBreak } from '../grapheme.js'
import { GlyphWrapper, skipWhitespace } from './index.js'

export const WordWrapper: GlyphWrapper = (
  { text, fontSize, font, letterSpacing },
  availableWidth,
  charIndex,
  target,
) => {
  charIndex = skipWhitespace(text, charIndex)
  const firstIndex = charIndex
  target.charIndexOffset = firstIndex
  target.nonWhitespaceCharLength = 0
  target.charLength = 0
  target.nonWhitespaceWidth = 0
  target.whitespacesBetween = 0

  let position = 0
  let whitespaces = 0
  for (; charIndex < text.length; ) {
    const nextCharIndex = getNextGraphemeBreak(text, charIndex)
    const char = getGrapheme(text, charIndex, nextCharIndex)
    if (char === '\n') {
      target.charLength = nextCharIndex - firstIndex
      break
    }

    position += getOffsetToNextGlyph(fontSize, font.resolveGlyph(char).glyphInfo, letterSpacing)

    if (char === ' ') {
      whitespaces += 1
      target.charLength = nextCharIndex - firstIndex
      charIndex = nextCharIndex
      continue
    }

    //non whitespace
    if (target.nonWhitespaceWidth > 0 && availableWidth != null && position > availableWidth) {
      break
    }

    const nextChar = text[nextCharIndex]
    if (nextChar === ' ' || nextChar === '\n' || nextChar == null) {
      //next char is a whitespace/end of text => save point
      target.charLength = nextCharIndex - firstIndex
      target.nonWhitespaceCharLength = target.charLength
      target.nonWhitespaceWidth = position
      target.whitespacesBetween = whitespaces
    }
    charIndex = nextCharIndex
  }
}
