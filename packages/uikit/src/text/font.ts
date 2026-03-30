import { Signal, computed, effect, signal } from '@preact/signals-core'
import { CanvasTexture, LinearFilter, SRGBColorSpace, Texture, TypedArray } from 'three'
import { loadCachedFont } from './cache.js'
import { Properties } from '../properties/index.js'
import { inter } from '@ni2khanna/msdfonts'
import { Container } from '../components/container.js'

export type FontFamilyWeightMap = Partial<Record<FontWeight, string | FontInfo>>

export type FontFamilies = Record<string, FontFamilyWeightMap>

const fontWeightNames = {
  thin: 100,
  'extra-light': 200,
  light: 300,
  normal: 400,
  medium: 500,
  'semi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  black: 900,
  'extra-black': 950,
}

export type FontWeight = keyof typeof fontWeightNames | number | ({} & string)

export type FontFamilyList = string | Array<string>

export type FontFamilyProperties = {
  fontFamily?: FontFamilyList
  fontFamilyFallbacks?: FontFamilyList
  fontWeight?: FontWeight
  fontFamilies?: FontFamilies
}

const defaultFontFamiles: FontFamilies = {
  inter,
}

export function computedFontFamilies(properties: Properties, parent: Signal<Container | undefined>) {
  return computed(() => {
    const currentFontFamilies = properties.value.fontFamilies
    const inheritedFontFamilies = parent.value?.fontFamilies.value
    if (inheritedFontFamilies == null) {
      return currentFontFamilies
    }
    if (currentFontFamilies == null) {
      return inheritedFontFamilies
    }
    return {
      ...inheritedFontFamilies,
      ...currentFontFamilies,
    }
  })
}

export function computedFont(
  properties: Properties,
  fontFamiliesSignal: Signal<FontFamilies | undefined>,
): Signal<Font | undefined> {
  const result = signal<Font | undefined>(undefined)
  effect(() => {
    let fontWeight: FontWeight = properties.value.fontWeight
    if (typeof fontWeight === 'string') {
      fontWeight = parseFloat(fontWeight)
      if (isNaN(fontWeight)) {
        fontWeight = properties.value.fontWeight
        if (!(fontWeight in fontWeightNames)) {
          throw new Error(`unknown font weight "${fontWeight}"`)
        }
        fontWeight = fontWeightNames[fontWeight as keyof typeof fontWeightNames]
      }
    }
    let fontFamily = normalizeFontFamilyList(properties.value.fontFamily)[0]
    const inheritedFontFamilies = fontFamiliesSignal.value
    if (inheritedFontFamilies == null && fontFamily != null && defaultFontFamiles[fontFamily as keyof FontFamilies] == null) {
      result.value = undefined
      return
    }
    const fontFamilies = inheritedFontFamilies ?? defaultFontFamiles
    fontFamily ??= Object.keys(fontFamilies)[0]!
    const family = fontFamilies[fontFamily as keyof FontFamilies]
    if (family == null) {
      throw new Error(`unknown font family "${fontFamily}"`)
    }
    const url = getMatchingFontUrl(family, fontWeight)
    let aborted = false
    loadCachedFont(url, (font) => !aborted && (result.value = font))
    return () => (aborted = true)
  })
  return result
}

export function computedFonts(
  properties: Properties,
  fontFamiliesSignal: Signal<FontFamilies | undefined>,
): Signal<ResolvedFontFamily | undefined> {
  const result = signal<ResolvedFontFamily | undefined>(undefined)
  effect(() => {
    let fontWeight: FontWeight = properties.value.fontWeight
    if (typeof fontWeight === 'string') {
      fontWeight = parseFloat(fontWeight)
      if (isNaN(fontWeight)) {
        fontWeight = properties.value.fontWeight
        if (!(fontWeight in fontWeightNames)) {
          throw new Error(`unknown font weight "${fontWeight}"`)
        }
        fontWeight = fontWeightNames[fontWeight as keyof typeof fontWeightNames]
      }
    }

    const requestedFamilies = normalizeFontFamilyList(properties.value.fontFamily)
    const inheritedFontFamilies = fontFamiliesSignal.value
    if (
      inheritedFontFamilies == null &&
      requestedFamilies.length > 0 &&
      requestedFamilies.some((familyName) => defaultFontFamiles[familyName as keyof FontFamilies] == null)
    ) {
      result.value = undefined
      return
    }
    const fontFamilies = inheritedFontFamilies ?? defaultFontFamiles
    const familyNames = getOrderedFontFamilyNames(
      fontFamilies,
      properties.value.fontFamily,
      properties.value.fontFamilyFallbacks,
    )
    if (familyNames.length === 0) {
      result.value = undefined
      return
    }

    const entries = familyNames.flatMap((familyName) => {
      const family = fontFamilies[familyName as keyof FontFamilies]
      if (family == null) {
        return []
      }
      return [{ familyName, url: getMatchingFontUrl(family, fontWeight) }] as const
    })

    if (entries.length === 0) {
      result.value = undefined
      return
    }

    let aborted = false
    const loadedFonts = new Map<string | FontInfo, Font>()

    const updateResult = () => {
      if (aborted) {
        return
      }
      const primaryFont = loadedFonts.get(entries[0]!.url)
      if (primaryFont == null) {
        result.value = undefined
        return
      }
      const fonts = entries
        .map(({ url }) => loadedFonts.get(url))
        .filter((font): font is Font => font != null)
      result.value = new ResolvedFontFamily(primaryFont, fonts.slice(1))
    }

    for (const { url } of entries) {
      loadCachedFont(url, (font) => {
        loadedFonts.set(url, font)
        updateResult()
      })
    }

    return () => {
      aborted = true
    }
  })
  return result
}

function getOrderedFontFamilyNames(fontFamilies: FontFamilies, primary?: FontFamilyList, fallbacks?: FontFamilyList) {
  const ordered = new Set<string>()
  const primaryFamilies = normalizeFontFamilyList(primary)
  const fallbackFamilies = normalizeFontFamilyList(fallbacks)
  const allFamilies = Object.keys(fontFamilies)
  const firstFamily = primaryFamilies[0] ?? allFamilies[0]
  if (firstFamily != null) {
    ordered.add(firstFamily)
  }
  for (const familyName of primaryFamilies.slice(1)) {
    ordered.add(familyName)
  }
  for (const familyName of fallbackFamilies) {
    ordered.add(familyName)
  }
  for (const familyName of allFamilies) {
    ordered.add(familyName)
  }
  return Array.from(ordered).filter((familyName) => familyName in fontFamilies)
}

function normalizeFontFamilyList(value: FontFamilyList | undefined) {
  if (value == null) {
    return []
  }
  const values = Array.isArray(value) ? value : value.split(',')
  return values.map((entry) => entry.trim()).filter(Boolean)
}

function getMatchingFontUrl(fontFamily: FontFamilyWeightMap, weight: number): string | FontInfo {
  let distance = Infinity
  let result: string | FontInfo | undefined
  for (const fontWeight in fontFamily) {
    const d = Math.abs(weight - getWeightNumber(fontWeight))
    if (d === 0) {
      return fontFamily[fontWeight]!
    }
    if (d < distance) {
      distance = d
      result = fontFamily[fontWeight]
    }
  }
  if (result == null) {
    throw new Error(`font family has no entries ${fontFamily}`)
  }
  return result
}

function getWeightNumber(value: string): number {
  if (value in fontWeightNames) {
    return fontWeightNames[value as keyof typeof fontWeightNames]
  }
  const number = parseFloat(value)
  if (isNaN(number)) {
    throw new Error(`invalid font weight "${value}"`)
  }
  return number
}

export type FontInfo = {
  pages: Array<string>
  chars: Array<GlyphInfo>
  info: {
    face: string
    size: number
    bold: number
    italic: number
    charset: Array<string>
    unicode: number
    stretchH: number
    smooth: number
    aa: number
    padding: Array<number>
    spacing: Array<number>
    outline: number
  }
  common: {
    lineHeight: number
    base: number
    scaleW: number
    scaleH: number
    pages: number
    packed: number
    alphaChnl: number
    redChnl: number
    greenChnl: number
    blueChnl: number
  }
  distanceField: {
    fieldType: string
    distanceRange: number
  }
  kernings: Array<{
    first: number
    second: number
    amount: number
  }>
}

export type GlyphInfo = {
  id: number
  index: number
  char: string
  width: number
  height: number
  x: number
  y: number
  xoffset: number
  yoffset: number
  xadvance: number
  chnl: number
  page: number
  uvWidth?: number
  uvHeight?: number
  uvX?: number
  uvY?: number
}

export type FontRenderMode = 'msdf' | 'bitmap-alpha' | 'bitmap-color'

export class Font {
  private glyphInfoMap = new Map<string, GlyphInfo>()
  private kerningMap = new Map<string, number>()

  private questionmarkGlyphInfo: GlyphInfo | undefined

  //needed in the shader:
  public readonly pageWidth: number
  public readonly pageHeight: number
  public readonly distanceRange: number
  public readonly renderMode: FontRenderMode

  constructor(
    info: FontInfo,
    public page: Texture,
    renderMode: FontRenderMode = 'msdf',
  ) {
    const { scaleW, scaleH, lineHeight } = info.common

    this.pageWidth = scaleW
    this.pageHeight = scaleH
    this.distanceRange = info.distanceField.distanceRange
    this.renderMode = renderMode

    const { size } = info.info

    for (const glyph of info.chars) {
      this.registerGlyphInfo(glyph, size, lineHeight)
    }

    for (const { first, second, amount } of info.kernings) {
      this.kerningMap.set(`${first}/${second}`, amount / size)
    }

    this.questionmarkGlyphInfo = this.glyphInfoMap.get('?') ?? this.glyphInfoMap.get(' ')
  }

  protected registerGlyphInfo(glyph: GlyphInfo, size: number, lineHeight: number): GlyphInfo {
    glyph.uvX = glyph.x / this.pageWidth
    glyph.uvY = glyph.y / this.pageHeight
    glyph.uvWidth = glyph.width / this.pageWidth
    glyph.uvHeight = glyph.height / this.pageHeight
    glyph.width /= size
    glyph.height /= size
    glyph.xadvance /= size
    glyph.xoffset /= size
    glyph.yoffset -= lineHeight - size
    glyph.yoffset /= size
    this.glyphInfoMap.set(glyph.char, glyph)
    if (glyph.char === '?') {
      this.questionmarkGlyphInfo = glyph
    }
    return glyph
  }

  protected registerKerning(firstId: number, secondId: number, amount: number, size: number): void {
    this.kerningMap.set(`${firstId}/${secondId}`, amount / size)
  }

  protected setQuestionmarkGlyphInfo(glyph: GlyphInfo): void {
    this.questionmarkGlyphInfo = glyph
  }

  hasGlyph(char: string): boolean {
    return this.glyphInfoMap.has(char)
  }

  getOptionalGlyphInfo(char: string): GlyphInfo | undefined {
    return this.glyphInfoMap.get(char)
  }

  getGlyphInfo(char: string): GlyphInfo {
    const glyph =
      this.glyphInfoMap.get(char) ??
      (char == '\n' ? this.glyphInfoMap.get(' ') : this.questionmarkGlyphInfo) ??
      this.glyphInfoMap.get(' ')
    if (glyph == null) {
      throw new Error(`missing glyph "${char}" in font`)
    }
    return glyph
  }

  getKerning(firstId: number, secondId: number): number {
    return this.kerningMap.get(`${firstId}/${secondId}`) ?? 0
  }
}

export type ResolvedGlyph = {
  font: Font
  glyphInfo: GlyphInfo
}

export class ResolvedFontFamily {
  private readonly fonts: Array<Font>
  private readonly glyphCache = new Map<string, ResolvedGlyph>()

  constructor(
    public readonly primaryFont: Font,
    fallbackFonts: Array<Font>,
  ) {
    this.fonts = [primaryFont, ...fallbackFonts]
  }

  resolveGlyph(char: string): ResolvedGlyph {
    const cached = this.glyphCache.get(char)
    if (cached != null) {
      return cached
    }

    let glyph: ResolvedGlyph | undefined

    if (char === '\n') {
      glyph = { font: this.primaryFont, glyphInfo: this.primaryFont.getGlyphInfo(' ') }
    } else {
      for (const font of this.fonts) {
        const glyphInfo = font.getOptionalGlyphInfo(char)
        if (glyphInfo == null) {
          continue
        }
        glyph = { font, glyphInfo }
        break
      }
    }

    glyph ??= getBitmapFallbackGlyph(char)
    glyph ??= { font: this.primaryFont, glyphInfo: this.primaryFont.getGlyphInfo(char) }
    this.glyphCache.set(char, glyph)
    return glyph
  }

  getKerning(previousGlyph: ResolvedGlyph | undefined, nextGlyph: ResolvedGlyph): number {
    if (previousGlyph == null || previousGlyph.font !== nextGlyph.font) {
      return 0
    }
    return nextGlyph.font.getKerning(previousGlyph.glyphInfo.id, nextGlyph.glyphInfo.id)
  }
}

export function glyphIntoToUV(info: GlyphInfo, target: TypedArray, offset: number): void {
  target[offset + 0] = info.uvX!
  target[offset + 1] = info.uvY! + info.uvHeight!
  target[offset + 2] = info.uvWidth!
  target[offset + 3] = -info.uvHeight!
}

const bitmapAtlasSize = 2048
const bitmapEmSize = 128
const bitmapPadding = 16
const bitmapColorFontSize = 112
const bitmapMinGlyphWidth = Math.ceil(bitmapEmSize * 0.35)
const bitmapAlphaFontStack =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const bitmapColorFontStack =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif'

const extendedPictographicRegex = createExtendedPictographicRegex()

let bitmapAlphaFallbackFont: BitmapFallbackFont | undefined
let bitmapColorFallbackFont: BitmapFallbackFont | undefined

function getBitmapFallbackGlyph(char: string): ResolvedGlyph | undefined {
  if (typeof document === 'undefined' || char.length === 0 || char === '\n') {
    return undefined
  }
  const font = shouldUseColorBitmapFallback(char)
    ? (bitmapColorFallbackFont ??= new BitmapFallbackFont('bitmap-color'))
    : (bitmapAlphaFallbackFont ??= new BitmapFallbackFont('bitmap-alpha'))
  const glyphInfo = font.ensureGlyph(char)
  return glyphInfo == null ? undefined : { font, glyphInfo }
}

function shouldUseColorBitmapFallback(char: string): boolean {
  return extendedPictographicRegex?.test(char) ?? Array.from(char).some((entry) => (entry.codePointAt(0) ?? 0) >= 0x1f000)
}

function createExtendedPictographicRegex() {
  try {
    return new RegExp('\\p{Extended_Pictographic}', 'u')
  } catch {
    return undefined
  }
}

class BitmapFallbackFont extends Font {
  private readonly context: CanvasRenderingContext2D
  private nextGlyphId = 1
  private nextX = 0
  private nextY = 0
  private rowHeight = 0

  constructor(renderMode: Exclude<FontRenderMode, 'msdf'>) {
    const canvas = document.createElement('canvas')
    canvas.width = bitmapAtlasSize
    canvas.height = bitmapAtlasSize
    const texture = new CanvasTexture(canvas)
    texture.flipY = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    if (renderMode === 'bitmap-color') {
      texture.colorSpace = SRGBColorSpace
    }

    super(createBitmapFontInfo(), texture, renderMode)

    const context = canvas.getContext('2d')
    if (context == null) {
      throw new Error('failed to initialize bitmap fallback font canvas')
    }
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.textRendering = 'optimizeLegibility'
    this.context = context

    const questionmark = this.ensureGlyph('?')
    if (questionmark != null) {
      this.setQuestionmarkGlyphInfo(questionmark)
    }
    this.ensureGlyph(' ')
  }

  ensureGlyph(char: string): GlyphInfo | undefined {
    const existing = this.getOptionalGlyphInfo(char)
    if (existing != null) {
      return existing
    }

    const metrics =
      this.renderMode === 'bitmap-color' ? this.measureColorGlyph(char) : this.measureAlphaGlyph(char)
    const slot = this.allocateSlot(metrics.width, metrics.height)
    if (slot == null) {
      return this.getOptionalGlyphInfo('?')
    }

    this.context.clearRect(slot.x - bitmapPadding, slot.y - bitmapPadding, slot.width, slot.height)
    if (this.renderMode === 'bitmap-color') {
      this.drawColorGlyph(char, slot.x, slot.y, metrics.width, metrics.height)
    } else {
      this.drawAlphaGlyph(char, slot.x, slot.y, metrics.height)
    }

    const glyph = this.registerGlyphInfo(
      {
        id: this.nextGlyphId,
        index: this.nextGlyphId,
        char,
        width: metrics.width,
        height: metrics.height,
        x: slot.x,
        y: slot.y,
        xoffset: 0,
        yoffset: 0,
        xadvance: metrics.advance,
        chnl: 0,
        page: 0,
      },
      bitmapEmSize,
      bitmapEmSize,
    )
    this.nextGlyphId += 1
    this.page.needsUpdate = true
    return glyph
  }

  private measureColorGlyph(char: string) {
    this.context.font = `${bitmapColorFontSize}px ${bitmapColorFontStack}`
    const measuredWidth = Math.ceil(this.context.measureText(char).width)
    const width = Math.min(bitmapEmSize, Math.max(bitmapMinGlyphWidth, measuredWidth || bitmapEmSize))
    return { width, height: bitmapEmSize, advance: width }
  }

  private measureAlphaGlyph(char: string) {
    this.context.font = `${bitmapEmSize}px ${bitmapAlphaFontStack}`
    const measuredWidth = Math.ceil(this.context.measureText(char).width)
    const width = Math.min(bitmapEmSize, Math.max(bitmapMinGlyphWidth, measuredWidth || bitmapEmSize))
    return { width, height: bitmapEmSize, advance: width }
  }

  private drawColorGlyph(char: string, x: number, y: number, width: number, height: number): void {
    this.context.save()
    this.context.font = `${bitmapColorFontSize}px ${bitmapColorFontStack}`
    this.context.textAlign = 'center'
    this.context.textBaseline = 'middle'
    this.context.fillStyle = '#ffffff'
    this.context.fillText(char, x + width / 2, y + height / 2 + 1)
    this.context.restore()
  }

  private drawAlphaGlyph(char: string, x: number, y: number, height: number): void {
    this.context.save()
    this.context.font = `${bitmapEmSize}px ${bitmapAlphaFontStack}`
    this.context.textAlign = 'left'
    this.context.textBaseline = 'middle'
    this.context.fillStyle = '#ffffff'
    this.context.fillText(char, x, y + height / 2)
    this.context.restore()
  }

  private allocateSlot(contentWidth: number, contentHeight: number) {
    const width = contentWidth + bitmapPadding * 2
    const height = contentHeight + bitmapPadding * 2

    if (this.nextX + width > bitmapAtlasSize) {
      this.nextX = 0
      this.nextY += this.rowHeight
      this.rowHeight = 0
    }

    if (this.nextY + height > bitmapAtlasSize) {
      return undefined
    }

    const slot = {
      x: this.nextX + bitmapPadding,
      y: this.nextY + bitmapPadding,
      width,
      height,
    }

    this.nextX += width
    this.rowHeight = Math.max(this.rowHeight, height)
    return slot
  }
}

function createBitmapFontInfo(): FontInfo {
  return {
    pages: [''],
    chars: [],
    info: {
      face: 'bitmap-fallback',
      size: bitmapEmSize,
      bold: 0,
      italic: 0,
      charset: [],
      unicode: 1,
      stretchH: 100,
      smooth: 1,
      aa: 1,
      padding: [0, 0, 0, 0],
      spacing: [0, 0],
      outline: 0,
    },
    common: {
      lineHeight: bitmapEmSize,
      base: bitmapEmSize,
      scaleW: bitmapAtlasSize,
      scaleH: bitmapAtlasSize,
      pages: 1,
      packed: 0,
      alphaChnl: 0,
      redChnl: 0,
      greenChnl: 0,
      blueChnl: 0,
    },
    distanceField: {
      fieldType: 'bitmap',
      distanceRange: 1,
    },
    kernings: [],
  }
}
