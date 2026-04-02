import { expect } from 'chai'
import { Container } from '../src/index.js'
import { Object3D, Raycaster, Vector3 } from 'three'

function createRaycaster() {
  return new Raycaster(new Vector3(0, 0, 1), new Vector3(0, 0, -1))
}

function setupLayout(target: Container) {
  target.displayed.value = true
  target.size.value = [100, 100]
  target.relativeCenter.value = [0, 0]
}

function getIntersections(target: Container) {
  const intersects = []
  target.raycast(createRaycaster(), intersects)
  return intersects
}

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

  it('should not raycast hidden elements', () => {
    const root = new Object3D()
    const component = new Container()
    root.add(component)

    setupLayout(component)
    expect(getIntersections(component)).to.have.length.greaterThan(0)

    component.setProperties({ visibility: 'hidden' })
    expect(component.isVisible.value).to.equal(false)
    expect(getIntersections(component)).to.have.length(0)
  })

  it('should not raycast children when an ancestor is hidden', () => {
    const root = new Object3D()
    const parent = new Container()
    const child = new Container()
    root.add(parent)
    parent.add(child)

    setupLayout(parent)
    setupLayout(child)
    expect(getIntersections(child)).to.have.length.greaterThan(0)

    parent.visible = false
    expect(parent.isVisible.value).to.equal(false)
    expect(child.isVisible.value).to.equal(false)
    expect(getIntersections(child)).to.have.length(0)
  })
})
