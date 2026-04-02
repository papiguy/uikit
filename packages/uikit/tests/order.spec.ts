import { expect } from 'chai'
import { Object3D, RenderItem } from 'three'
import { ElementType, OrderInfo, reversePainterSortStable, setupRenderOrder } from '../src/order.js'

describe('render order', () => {
  it('should use scenegraph traversal order when render items are otherwise identical', () => {
    const parent = new Object3D()
    const first = new Object3D()
    const nestedParent = new Object3D()
    const nestedChild = new Object3D()
    const second = new Object3D()

    const rootState = { component: parent }
    const rootSignal = { peek: () => rootState }
    const orderInfo = {
      value: {
        majorIndex: 0,
        minorIndex: 0,
        elementType: ElementType.Image,
        patchIndex: 0,
      } satisfies OrderInfo,
    }

    parent.add(first)
    parent.add(nestedParent)
    nestedParent.add(nestedChild)
    parent.add(second)

    setupRenderOrder(first, rootSignal, orderInfo)
    setupRenderOrder(nestedParent, rootSignal, orderInfo)
    setupRenderOrder(nestedChild, rootSignal, orderInfo)
    setupRenderOrder(second, rootSignal, orderInfo)

    expect(reversePainterSortStable(createRenderItem(first), createRenderItem(nestedParent))).to.be.lessThan(0)
    expect(reversePainterSortStable(createRenderItem(nestedParent), createRenderItem(nestedChild))).to.be.lessThan(0)
    expect(reversePainterSortStable(createRenderItem(nestedChild), createRenderItem(second))).to.be.lessThan(0)
  })

  it('should use scenegraph traversal order across different uikit roots when z is identical', () => {
    const scene = new Object3D()
    const rootAComponent = new Object3D()
    const rootBComponent = new Object3D()
    const objectA = new Object3D()
    const objectB = new Object3D()

    scene.add(rootAComponent)
    scene.add(rootBComponent)
    rootAComponent.add(objectA)
    rootBComponent.add(objectB)

    const orderInfo = {
      value: {
        majorIndex: 0,
        minorIndex: 0,
        elementType: ElementType.Image,
        patchIndex: 0,
      } satisfies OrderInfo,
    }

    setupRenderOrder(objectA, { peek: () => ({ component: rootAComponent }) }, orderInfo)
    setupRenderOrder(objectB, { peek: () => ({ component: rootBComponent }) }, orderInfo)

    expect(reversePainterSortStable(createRenderItem(objectA), createRenderItem(objectB))).to.be.lessThan(0)
  })
})

function createRenderItem(object: Object3D): RenderItem {
  return {
    id: object.id,
    object,
    geometry: null,
    material: null,
    groupOrder: 0,
    renderOrder: 0,
    z: 0,
    group: null,
  } as unknown as RenderItem
}