import { getOffsetToNextGlyph } from '../utils.js'
import { getGrapheme, getNextGraphemeBreak } from '../grapheme.js'
import { GlyphWrapper, skipWhitespace } from './index.js'

export const NowrapWrapper: GlyphWrapper = ({ text, fontSize, font, letterSpacing }, _, charIndex, target) => {
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
      return
    }
    position += getOffsetToNextGlyph(fontSize, font.resolveGlyph(char).glyphInfo, letterSpacing)

    if (char === ' ') {
      whitespaces += 1
      charIndex = nextCharIndex
      continue
    }

    target.nonWhitespaceWidth = position
    target.whitespacesBetween = whitespaces
    target.nonWhitespaceCharLength = nextCharIndex - firstIndex
    charIndex = nextCharIndex
  }

  //not "+1" because we break when we want to remove the last one
  target.charLength = charIndex - firstIndex
}
