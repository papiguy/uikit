import { Signal } from '@preact/signals-core'
import { Object3D, RenderItem } from 'three'
import { abortableEffect, readReactive } from './utils.js'
import { Properties } from './properties/index.js'

export type WithReversePainterSortStableCache = {
  reversePainterSortStableCache?: number
  sceneGraphOrderCachePrepared?: boolean
}

export const reversePainterSortStableCacheKey = Symbol('reverse-painter-sort-stable-cache-key')
export const orderInfoKey = Symbol('order-info-key')
export const sceneGraphOrderKey = Symbol('scene-graph-order-key')
export const sceneGraphPathKey = Symbol('scene-graph-path-key')
export const sceneGraphPathParentKey = Symbol('scene-graph-path-parent-key')
export const sceneGraphPathParentCacheKey = Symbol('scene-graph-path-parent-cache-key')

export function reversePainterSortStable(a: RenderItem, b: RenderItem) {
  if (a.groupOrder !== b.groupOrder) {
    return a.groupOrder - b.groupOrder
  }
  if (a.renderOrder !== b.renderOrder) {
    return a.renderOrder - b.renderOrder
  }
  let az = a.z
  let bz = b.z
  const aRootSignal = (a.object as any)[reversePainterSortStableCacheKey] as
    | { peek(): WithReversePainterSortStableCache }
    | undefined
  const bRootSignal = (b.object as any)[reversePainterSortStableCacheKey] as
    | { peek(): WithReversePainterSortStableCache }
    | undefined
  if (aRootSignal != null) {
    const root = aRootSignal.peek()
    root.reversePainterSortStableCache =
      root.reversePainterSortStableCache == null ? az : Math.min(root.reversePainterSortStableCache, az)
    az = root.reversePainterSortStableCache
  }
  if (bRootSignal != null) {
    const root = bRootSignal.peek()
    root.reversePainterSortStableCache =
      root.reversePainterSortStableCache == null ? bz : Math.min(root.reversePainterSortStableCache, bz)
    bz = root.reversePainterSortStableCache
  }
  const aRoot = aRootSignal?.peek() as (WithReversePainterSortStableCache & { component?: Object3D }) | undefined
  const bRoot = bRootSignal?.peek() as (WithReversePainterSortStableCache & { component?: Object3D }) | undefined
  if (aRoot != null && aRoot === bRoot) {
    const orderDiff = compareOrderInfo((a.object as any)[orderInfoKey]?.value, (b.object as any)[orderInfoKey]?.value)
    if (orderDiff !== 0) {
      return orderDiff
    }
  }
  if (aRoot != null && bRoot != null) {
    const aRootComponent = aRoot.component
    const bRootComponent = bRoot.component
    if (aRootComponent != null && bRootComponent != null) {
      const rootParent = aRootComponent.parent
      if (
        rootParent != null &&
        rootParent === bRootComponent.parent &&
        (rootParent as any).isCamera === true
      ) {
        const aIndex = rootParent.children.indexOf(aRootComponent)
        const bIndex = rootParent.children.indexOf(bRootComponent)
        if (aIndex !== bIndex) {
          return aIndex - bIndex
        }
      }
    }
  }
  //default z comparison
  if (az !== bz) {
    return bz - az
  }
  return compareSceneGraphOrder(a.object, b.object, aRoot, bRoot)
}

function compareSceneGraphOrder(
  a: Object3D,
  b: Object3D,
  aRoot: (WithReversePainterSortStableCache & { component?: Object3D }) | undefined,
  bRoot: (WithReversePainterSortStableCache & { component?: Object3D }) | undefined,
): number {
  if (a === b) {
    return 0
  }

  if (aRoot != null && aRoot === bRoot) {
    ensureSceneGraphOrderCache(aRoot)

    const aOrder = (a as any)[sceneGraphOrderKey] as number | undefined
    const bOrder = (b as any)[sceneGraphOrderKey] as number | undefined
    if (aOrder != null && bOrder != null && aOrder !== bOrder) {
      return aOrder - bOrder
    }
  }

  return compareSceneGraphOrderByPath(a, b)
}

function compareSceneGraphOrderByPath(a: Object3D, b: Object3D): number {
  const aPath = getPathToRoot(a)
  const bPath = getPathToRoot(b)
  const minLength = Math.min(aPath.length, bPath.length)

  let index = 0
  while (index < minLength && aPath[index] === bPath[index]) {
    index += 1
  }

  if (index === 0) {
    return a.id - b.id
  }

  if (index === aPath.length || index === bPath.length) {
    return aPath.length - bPath.length
  }

  const commonAncestor = aPath[index - 1]
  if (commonAncestor == null) {
    return a.id - b.id
  }
  const aIndex = commonAncestor.children.indexOf(aPath[index]!)
  const bIndex = commonAncestor.children.indexOf(bPath[index]!)

  if (aIndex === -1 || bIndex === -1 || aIndex === bIndex) {
    return a.id - b.id
  }

  return aIndex - bIndex
}

function getPathToRoot(object: Object3D): Array<Object3D> {
  const parent = object.parent
  const cachedPath = (object as any)[sceneGraphPathKey] as Array<Object3D> | undefined
  if (cachedPath != null) {
    const cachedParent = (object as any)[sceneGraphPathParentKey] as Object3D | null | undefined
    const cachedParentPath = (object as any)[sceneGraphPathParentCacheKey] as Array<Object3D> | undefined
    if (cachedParent === parent && (parent == null || cachedParentPath === (parent as any)[sceneGraphPathKey])) {
      return cachedPath
    }
  }

  const path = parent == null ? [object] : [...getPathToRoot(parent), object]
  ;(object as any)[sceneGraphPathKey] = path
  ;(object as any)[sceneGraphPathParentKey] = parent
  ;(object as any)[sceneGraphPathParentCacheKey] = parent == null ? undefined : (parent as any)[sceneGraphPathKey]
  return path
}

function ensureSceneGraphOrderCache(root: WithReversePainterSortStableCache & { component?: Object3D }): void {
  if (root.sceneGraphOrderCachePrepared) {
    return
  }

  let index = 0
  root.component?.traverse((object) => {
    ;(object as any)[sceneGraphOrderKey] = index++
  })
  root.sceneGraphOrderCachePrepared = true
}

//the following order tries to represent the most common element order of the respective element types (e.g. panels are most likely the background element)
export const ElementType = {
  Panel: 0, //render first
  Image: 1,
  Content: 2,
  Custom: 3,
  Text: 4, //render last
} as const

export type ElementType = (typeof ElementType)[keyof typeof ElementType]

export type OrderInfo = {
  majorIndex: number
  minorIndex: number
  elementType: ElementType
  patchIndex: number
  instancedGroupDependencies?: Signal<Record<string, any>> | Record<string, any>
}

export function compareOrderInfo(o1: OrderInfo | undefined, o2: OrderInfo | undefined): number {
  if (o1 == null || o2 == null) {
    return 0
  }
  let dif = o1.majorIndex - o2.majorIndex
  if (dif != 0) {
    return dif
  }
  dif = o1.minorIndex - o2.minorIndex
  if (dif != 0) {
    return dif
  }
  dif = o1.elementType - o2.elementType
  if (dif != 0) {
    return dif
  }
  return o1.patchIndex - o2.patchIndex
}

export type ZIndexProperties = {
  zIndex?: number
  zIndexOffset?: number
}

export function setupOrderInfo(
  target: Signal<OrderInfo | undefined>,
  properties: Properties,
  zIndexKey: string,
  type: ElementType,
  instancedGroupDependencies: Signal<Record<string, any>> | Record<string, any> | undefined,
  basisOrderInfoSignal: Signal<OrderInfo | undefined | null>,
  abortSignal: AbortSignal,
): void {
  abortableEffect(() => {
    if (basisOrderInfoSignal.value === undefined) {
      target.value = undefined
      return
    }

    const basisOrderInfo = basisOrderInfoSignal.value
    //similiar but not the same as in css
    const majorIndex = properties.value[zIndexKey as 'zIndex'] ?? basisOrderInfo?.majorIndex ?? 0

    let minorIndex: number
    let patchIndex: number

    if (basisOrderInfo == null) {
      minorIndex = 0
      patchIndex = 0
    } else if (type > basisOrderInfo.elementType) {
      minorIndex = basisOrderInfo.minorIndex
      patchIndex = 0
    } else if (
      type != basisOrderInfo.elementType ||
      !shallowEqualRecord(
        readReactive(instancedGroupDependencies),
        readReactive(basisOrderInfo.instancedGroupDependencies),
      )
    ) {
      minorIndex = basisOrderInfo.minorIndex + 1
      patchIndex = 0
    } else {
      minorIndex = basisOrderInfo.minorIndex
      patchIndex = basisOrderInfo.patchIndex + 1
    }

    patchIndex += properties.value['zIndexOffset'] ?? 0

    target.value = {
      instancedGroupDependencies,
      elementType: type,
      majorIndex,
      minorIndex,
      patchIndex,
    }
  }, abortSignal)
}

function shallowEqualRecord(r1: Record<string, any> | undefined, r2: Record<string, any> | undefined): boolean {
  if (r1 === r2) {
    return true
  }
  if (r1 == null || r2 == null) {
    return false
  }
  //i counts the number of keys in r1
  let i = 0
  for (const key in r1) {
    if (r1[key] != r2[key]) {
      return false
    }
    ++i
  }
  return i === Object.keys(r2).length
}

export function setupRenderOrder(
  target: Object3D<any>,
  root: { peek(): WithReversePainterSortStableCache },
  orderInfo: { value: OrderInfo | undefined },
) {
  const rootValue = root.peek()
  rootValue.sceneGraphOrderCachePrepared = false
  ;(target as any)[reversePainterSortStableCacheKey] = root
  ;(target as any)[orderInfoKey] = orderInfo
  ;(target as any)[sceneGraphOrderKey] = undefined
  ;(target as any)[sceneGraphPathKey] = undefined
  ;(target as any)[sceneGraphPathParentKey] = undefined
  ;(target as any)[sceneGraphPathParentCacheKey] = undefined
}
