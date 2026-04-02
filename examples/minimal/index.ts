import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import {
  reversePainterSortStable,
  Container,
  Text,
  Input,
  Fullscreen,
  initNodeMaterials,
  initGlyphNodeMaterials,
} from '@ni2khanna/uikit'
import type { RendererLike } from '@ni2khanna/uikit'
import { forwardHtmlEvents } from '@pmndrs/pointer-events'

type ExampleRenderer = RendererLike & {
  localClippingEnabled: boolean
  setSize(width: number, height: number): void
  setPixelRatio(value: number): void
  setAnimationLoop(callback: (time: number) => void): void
}

const emojiCharacters = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
].join(' ')

const appBackgroundColor = 0x020617

async function createRenderer(canvas: HTMLCanvasElement) {
  const params = new URLSearchParams(window.location.search)
  if (params.get('renderer') === 'webgpu') {
    const { WebGPURenderer } = await import('three/webgpu')
    const renderer = new WebGPURenderer({ antialias: true, canvas })
    await renderer.init()
    await Promise.all([initNodeMaterials(), initGlyphNodeMaterials()])
    return renderer
  }
  return new WebGLRenderer({ antialias: true, canvas })
}

const canvas = document.getElementById('root') as HTMLCanvasElement
const camera = new PerspectiveCamera(70, 1, 0.01, 100)
camera.position.z = 5

const scene = new Scene()
scene.background = new Color(appBackgroundColor)
scene.add(camera)

const { update } = forwardHtmlEvents(canvas, camera, scene)

const renderer = (await createRenderer(canvas)) as ExampleRenderer
renderer.localClippingEnabled = true
renderer.setTransparentSort(reversePainterSortStable)

// UI root
const root = new Fullscreen(renderer, {
  flexDirection: 'row',
  gap: 24,
  padding: 32,
  alignItems: 'flex-start',
  justifyContent: 'center',
  overflow: 'scroll',
})
camera.add(root)

const leftColumn = new Container({
  width: 300,
  flexDirection: 'column',
  gap: 16,
})
root.add(leftColumn)

const rightColumn = new Container({
  width: 480,
  flexDirection: 'column',
  gap: 16,
})
root.add(rightColumn)

// --- Hover button ---
const hoverButton = new Container({
  width: 300,
  height: 50,
  backgroundColor: 0x2563eb,
  hover: { backgroundColor: 0x1d4ed8 },
  active: { backgroundColor: 0x1e40af },
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  onClick: () => {
    clickCountLabel.setProperties({ text: `Clicked ${++clickCount} time(s)` })
  },
})
leftColumn.add(hoverButton)

const hoverLabel = new Text({
  text: 'Hover & Click Me',
  fontSize: 18,
  color: 'white',
})
hoverButton.add(hoverLabel)

// --- Click counter ---
let clickCount = 0
const clickCountLabel = new Text({
  text: 'Clicked 0 time(s)',
  fontSize: 14,
  color: 0x888888,
})
leftColumn.add(clickCountLabel)

// --- Toggle button ---
let toggled = false
const toggleButton = new Container({
  width: 300,
  height: 50,
  backgroundColor: 0x16a34a,
  hover: { backgroundColor: 0x15803d },
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  onClick: () => {
    toggled = !toggled
    toggleButton.setProperties({
      backgroundColor: toggled ? 0xdc2626 : 0x16a34a,
      hover: { backgroundColor: toggled ? 0xb91c1c : 0x15803d },
    })
    toggleLabel.setProperties({ text: toggled ? 'ON (click to toggle)' : 'OFF (click to toggle)' })
  },
})
leftColumn.add(toggleButton)

const toggleLabel = new Text({
  text: 'OFF (click to toggle)',
  fontSize: 18,
  color: 'white',
})
toggleButton.add(toggleLabel)

// --- Pointer events demo ---
let pointerEventsDisabled = false
let pointerEventsClickCount = 0

const pointerEventsToggle = new Container({
  width: 300,
  height: 50,
  backgroundColor: 0x7c3aed,
  hover: { backgroundColor: 0x6d28d9 },
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  onClick: () => {
    pointerEventsDisabled = !pointerEventsDisabled
    pointerEventsTarget.setProperties({
      pointerEvents: pointerEventsDisabled ? 'none' : 'auto',
      opacity: pointerEventsDisabled ? 0.45 : 1,
      backgroundColor: pointerEventsDisabled ? 0x374151 : 0xf59e0b,
      hover: { backgroundColor: pointerEventsDisabled ? 0x374151 : 0xd97706 },
      cursor: pointerEventsDisabled ? 'default' : 'pointer',
    })
    pointerEventsToggleLabel.setProperties({
      text: pointerEventsDisabled ? 'Pointer Events: none' : 'Pointer Events: auto',
    })
    pointerEventsStatus.setProperties({
      text: pointerEventsDisabled ? 'Target is non-interactable' : 'Target is clickable',
      color: pointerEventsDisabled ? 0xfca5a5 : 0x86efac,
    })
  },
})
leftColumn.add(pointerEventsToggle)

const pointerEventsToggleLabel = new Text({
  text: 'Pointer Events: auto',
  fontSize: 18,
  color: 'white',
})
pointerEventsToggle.add(pointerEventsToggleLabel)

const pointerEventsTarget = new Container({
  width: 300,
  height: 50,
  backgroundColor: 0xf59e0b,
  hover: { backgroundColor: 0xd97706 },
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  onClick: () => {
    pointerEventsClicks.setProperties({ text: `Pointer target clicks: ${++pointerEventsClickCount}` })
  },
})
leftColumn.add(pointerEventsTarget)

const pointerEventsTargetLabel = new Text({
  text: 'Click Me Then Disable Me',
  fontSize: 18,
  color: 'white',
})
pointerEventsTarget.add(pointerEventsTargetLabel)

const pointerEventsStatus = new Text({
  text: 'Target is clickable',
  fontSize: 14,
  color: 0x86efac,
})
leftColumn.add(pointerEventsStatus)

const pointerEventsClicks = new Text({
  text: 'Pointer target clicks: 0',
  fontSize: 14,
  color: 0x888888,
})
leftColumn.add(pointerEventsClicks)

// --- Text input ---
const inputContainer = new Container({
  width: 300,
  flexDirection: 'column',
  gap: 6,
})
rightColumn.add(inputContainer)

const inputLabel = new Text({
  text: 'Type something:',
  fontSize: 14,
  color: 0xcccccc,
})
inputContainer.add(inputLabel)

const inputField = new Container({
  width: 300,
  height: 40,
  positionType: 'relative',
  cursor: 'text',
  onClick: () => textInput.focus(),
})
inputContainer.add(inputField)

let inputValue = ''

const textInput = new Input({
  width: '100%',
  height: '100%',
  backgroundColor: 0x1e293b,
  hover: { backgroundColor: 0x334155 },
  borderRadius: 8,
  borderWidth: 1,
  borderColor: 0x475569,
  paddingX: 12,
  fontSize: 16,
  color: 'white',
  placeholder: '',
  defaultValue: '',
  onValueChange: (value: string) => {
    inputValue = value
    placeholderLabel.setProperties({ display: inputValue.length === 0 ? 'flex' : 'none' })
    echoLabel.setProperties({ text: value ? `Echo: ${value}` : 'Echo: (empty)' })
  },
})
inputField.add(textInput)

const placeholderLabel = new Text({
  text: 'Enter some text...',
  positionType: 'absolute',
  inset: 0,
  paddingX: 12,
  fontSize: 16,
  lineHeight: '40px',
  color: 0x64748b,
  pointerEvents: 'none',
})
inputField.add(placeholderLabel)

const echoLabel = new Text({
  text: 'Echo: (empty)',
  fontSize: 13,
  color: 0x94a3b8,
})
inputContainer.add(echoLabel)

// --- Scrollable list ---
const scrollContainer = new Container({
  width: 300,
  height: 150,
  overflow: 'scroll',
  scrollbarZIndex: 1,
  backgroundColor: 0x0f172a,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 0x334155,
  flexDirection: 'column',
  paddingY: 8,
})
rightColumn.add(scrollContainer)

for (let i = 0; i < 20; i++) {
  const item = new Container({
    width: '100%',
    height: 36,
    paddingX: 14,
    alignItems: 'center',
    hover: { backgroundColor: 0x1e293b },
    cursor: 'pointer',
    onClick: () => {
      clickCountLabel.setProperties({ text: `Selected: Item ${i + 1}` })
    },
  })
  scrollContainer.add(item)

  const itemText = new Text({
    text: `Item ${i + 1}`,
    fontSize: 14,
    color: 0xcbd5e1,
  })
  item.add(itemText)
}

// --- Hover info card ---
const card = new Container({
  width: 300,
  backgroundColor: 0x1e293b,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 0x334155,
  flexDirection: 'column',
  padding: 16,
  gap: 8,
  hover: { borderColor: 0x3b82f6 },
  onHoverChange: (hover: boolean) => {
    cardHint.setProperties({
      text: hover ? 'You are hovering!' : 'Hover over this card',
      color: hover ? 0x3b82f6 : 0x64748b,
    })
  },
})
rightColumn.add(card)

const cardTitle = new Text({
  text: 'Interactive Card',
  fontSize: 16,
  color: 'white',
})
card.add(cardTitle)

const cardHint = new Text({
  text: 'Hover over this card',
  fontSize: 13,
  color: 0x64748b,
})
card.add(cardHint)

// --- Emoji fallback card ---
const emojiCard = new Container({
  width: 480,
  backgroundColor: 0x111827,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 0x374151,
  flexDirection: 'column',
  gap: 10,
  padding: 16,
})
rightColumn.add(emojiCard)

emojiCard.add(
  new Text({
    text: 'Bitmap Fallback For Missing MSDF Glyphs',
    fontSize: 15,
    color: 'white',
  }),
)

emojiCard.add(
  new Text({
    text: 'Emoji now render through a bitmap atlas instead of falling back to ? when the MSDF font is missing them.',
    fontSize: 13,
    lineHeight: '18px',
    color: 0x9ca3af,
    width: '100%',
    wordBreak: 'break-word',
  }),
)

emojiCard.add(
  new Text({
    text: emojiCharacters,
    fontSize: 20,
    lineHeight: '28px',
    width: '100%',
    color: 'white',
    wordBreak: 'break-word',
  }),
)

// Resize handler
function updateSize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
updateSize()
window.addEventListener('resize', updateSize)

// Animation loop
let prev: number | undefined
renderer.setAnimationLoop((time: number) => {
  const delta = prev == null ? 0 : time - prev
  prev = time
  update()
  root.update(delta)
  renderer.render(scene, camera)
})
