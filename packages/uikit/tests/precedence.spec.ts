import { expect } from 'chai'
import { PropertiesImplementation as PubSubPropertiesImplementation } from '@ni2khanna/uikit-pub-sub'
import { signal } from '@preact/signals-core'
import { PropertiesImplementation as UIKitPropertiesImplementation } from '../src/properties/index.js'
import { allAliases } from '../src/properties/alias.js'

describe('properties precedence', () => {
  it('should use undefined as ignore and null as unset (without signals)', () => {
    const merged = new PubSubPropertiesImplementation<Record<string, unknown>, Record<string, unknown>>(
      (key, value, set) => set(key, value),
    )

    merged.setEnabled(true)
    merged.set(2, 'x', 1)
    expect(merged.value.x).to.equal(1)

    merged.set(1, 'x', undefined)
    expect(merged.value.x).to.equal(1)

    merged.set(0, 'x', null)
    expect(merged.value.x == null).to.true
  })

  it('should use undefined as ignore and null as unset (with signals)', () => {
    const merged = new PubSubPropertiesImplementation<Record<string, unknown>, Record<string, unknown>>(
      (key, value, set) => set(key, value),
    )

    merged.setEnabled(true)
    merged.set(2, 'x', signal(1))
    expect(merged.value.x).to.equal(1)

    merged.set(1, 'x', signal(undefined))
    expect(merged.value.x).to.equal(1)

    const f = signal<null | undefined>(null)
    merged.set(0, 'x', f)
    expect(merged.value.x == null).to.true

    f.value = undefined
    expect(merged.value.x).to.equal(1)
  })

  it('should apply conditional hover properties above base properties', () => {
    const properties = new UIKitPropertiesImplementation(allAliases, { hover: () => true })

    properties.setEnabled(true)
    properties.setLayersWithConditionals(
      { type: 'base' },
      {
        height: 8,
        hover: {
          height: 20,
        },
      },
    )

    expect(properties.value.height).to.equal(20)
  })

  it('should map borderTopRadius to the top corners only', () => {
    const properties = new UIKitPropertiesImplementation(allAliases, {})

    properties.setEnabled(true)

    properties.setLayer(0, {
      borderTopRadius: 20,
    })

    expect(properties.value.borderTopLeftRadius).to.equal(20)
    expect(properties.value.borderTopRightRadius).to.equal(20)
    expect(properties.value.borderBottomLeftRadius).to.equal(undefined)
    expect(properties.value.borderBottomRightRadius).to.equal(undefined)
  })

  it('should let borderTopRadius override the top corners after borderRadius', () => {
    const properties = new UIKitPropertiesImplementation(allAliases, {})

    properties.setEnabled(true)

    properties.setLayer(0, {
      borderRadius: 8,
      borderTopRadius: 20,
    })

    expect(properties.value.borderTopLeftRadius).to.equal(20)
    expect(properties.value.borderTopRightRadius).to.equal(20)
    expect(properties.value.borderBottomLeftRadius).to.equal(8)
    expect(properties.value.borderBottomRightRadius).to.equal(8)
  })
})
