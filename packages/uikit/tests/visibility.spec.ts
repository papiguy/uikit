import { expect } from 'chai'
import { Container } from '../src/index.js'
import { Object3D } from 'three'

describe('visibility hierarchy', () => {
  it('should hide children when parent node visibility is false', () => {
    const root = new Object3D()
    const parent = new Container()
    const child = new Container({ visibility: 'visible' })
    root.add(parent)
    parent.add(child)

    parent.displayed.value = true
    child.displayed.value = true
    parent.size.value = [1, 1]
    child.size.value = [1, 1]

    expect(parent.isVisible.value).to.equal(true)
    expect(child.isVisible.value).to.equal(true)

    parent.visible = false

    expect(parent.isVisible.value).to.equal(false)
    expect(child.isVisible.value).to.equal(false)
  })

  it('should still respect child visibility when parent node is visible', () => {
    const root = new Object3D()
    const parent = new Container()
    const child = new Container({ visibility: 'visible' })
    root.add(parent)
    parent.add(child)

    parent.displayed.value = true
    child.displayed.value = true
    parent.size.value = [1, 1]
    child.size.value = [1, 1]

    expect(child.isVisible.value).to.equal(true)

    child.setProperties({ visibility: 'hidden' })
    expect(child.isVisible.value).to.equal(false)

    child.setProperties({ visibility: 'visible' })
    expect(child.isVisible.value).to.equal(true)
  })
})
