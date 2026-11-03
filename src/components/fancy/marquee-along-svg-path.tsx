/* fancycomponents' MarqueeAlongSvgPath, as frame-site carries it (with
   its two fixes: a stable `useId` path id, and each item a real
   component so its hooks are its own), plus one addition for this site.

   THE ADDITION: ITEMS CAN KNOW WHERE THEY ARE

   frame's belts carry photographs, which only need to be put somewhere.
   Ours carry Pokémon that walk, and a walker needs two things a plate
   doesn't: which way the belt is moving right now (to face it, and to
   turn round when somebody drags it backwards) and how far it has gone
   (so its feet step with the distance covered rather than on a clock,
   and slow down with the belt under the pointer). The marquee already
   computes both; `useMarqueeItem()` hands them to whatever is inside an
   item, as motion values, so reading them never re-renders anything. */

import React, { createContext, useCallback, useContext, useEffect, useId, useRef } from "react"
import type { RefObject } from "react"
import type { MotionValue } from "motion/react"
import type { SpringOptions } from "motion/react"
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react"

import { cn } from "../../lib/utils"

// Custom wrap function
const wrap = (min: number, max: number, value: number): number => {
  const range = max - min
  return ((((value - min) % range) + range) % range) + min
}

export interface MarqueeItemMotion {
  /** where this item is on the path, 0..100 */
  offset: MotionValue<number>
  /** the belt's speed in percent of the path per second, signed: + runs toward the path's end */
  velocity: MotionValue<number>
  /** total distance the belt has run, in percent of the path (unwrapped) */
  travelled: MotionValue<number>
  index: number
}

const ItemContext = createContext<MarqueeItemMotion | null>(null)

/** Inside a marquee item: its position and the belt's motion. */
export const useMarqueeItem = () => useContext(ItemContext)

type PreserveAspectRatioAlign =
  | "none"
  | "xMinYMin"
  | "xMidYMin"
  | "xMaxYMin"
  | "xMinYMid"
  | "xMidYMid"
  | "xMaxYMid"
  | "xMinYMax"
  | "xMidYMax"
  | "xMaxYMax"

interface CSSVariableInterpolation {
  property: string
  from: number | string
  to: number | string
}

type PreserveAspectRatioMeetOrSlice = "meet" | "slice"

type PreserveAspectRatio =
  | PreserveAspectRatioAlign
  | `${Exclude<PreserveAspectRatioAlign, "none">} ${PreserveAspectRatioMeetOrSlice}`

interface MarqueeAlongSvgPathProps {
  children: React.ReactNode
  className?: string

  // Path properties
  path: string
  pathId?: string
  preserveAspectRatio?: PreserveAspectRatio
  showPath?: boolean

  // SVG properties
  width?: string | number
  height?: string | number
  viewBox?: string

  // Marquee properties
  baseVelocity?: number
  direction?: "normal" | "reverse"
  easing?: (value: number) => number
  slowdownOnHover?: boolean
  slowDownFactor?: number
  slowDownSpringConfig?: SpringOptions

  // Scroll properties
  useScrollVelocity?: boolean
  scrollAwareDirection?: boolean
  scrollSpringConfig?: SpringOptions
  scrollContainer?: RefObject<HTMLElement | null> | HTMLElement | null

  // Item repetition
  repeat?: number

  // Drag properties
  draggable?: boolean
  dragSensitivity?: number
  dragVelocityDecay?: number
  dragAwareDirection?: boolean
  grabCursor?: boolean

  // Z-index properties
  enableRollingZIndex?: boolean
  zIndexBase?: number
  zIndexRange?: number

  cssVariableInterpolation?: CSSVariableInterpolation[]

  // Responsive properties
  responsive?: boolean

  /** Extra style on every item, e.g. `offsetRotate` / `offsetAnchor`: walkers stand upright on the
   *  path by their feet, where frame's plates lie along it by their center. */
  itemStyle?: React.CSSProperties
}

const MarqueeAlongSvgPath = ({
  children,
  className,

  // Path defaults
  path,
  pathId,
  preserveAspectRatio = "xMidYMid meet",
  showPath = false,

  // SVG defaults
  width = "100%",
  height = "100%",
  viewBox = "0 0 100 100",

  // Marquee defaults
  baseVelocity = 5,
  direction = "normal",
  easing,
  slowdownOnHover = false,
  slowDownFactor = 0.3,
  slowDownSpringConfig = { damping: 50, stiffness: 400 },

  // Scroll defaults
  useScrollVelocity = false,
  scrollAwareDirection = false,
  scrollSpringConfig = { damping: 50, stiffness: 400 },
  scrollContainer,

  // Items repetition
  repeat = 3,

  // Drag defaults
  draggable = false,
  dragSensitivity = 0.2,
  dragVelocityDecay = 0.96,
  dragAwareDirection = false,
  grabCursor = false,

  // Z-index defaults
  enableRollingZIndex = true,
  zIndexBase = 1, // Base z-index value
  zIndexRange = 10, // Range of z-index values to use

  cssVariableInterpolation = [],

  // Responsive defaults
  responsive = false,
  itemStyle,
}: MarqueeAlongSvgPathProps) => {
  const container = useRef<HTMLDivElement>(null)
  const marqueeContainerRef = useRef<HTMLDivElement>(null)
  const baseOffset = useMotionValue(0)
  const velocity = useMotionValue(0)

  const pathRef = useRef<SVGPathElement>(null)

  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Responsive scaling using direct DOM manipulation (no re-renders)
  useEffect(() => {
    if (!responsive) return

    const [, , vbWidth, vbHeight] = viewBox.split(" ").map(Number)
    const originalWidth = vbWidth || 100
    const originalHeight = vbHeight || 100

    const updateScale = () => {
      const wrapper = container.current
      const marqueeContainer = marqueeContainerRef.current
      if (!wrapper || !marqueeContainer) return

      const wrapperWidth = wrapper.clientWidth
      const wrapperHeight = wrapper.clientHeight

      const scaleX = wrapperWidth / originalWidth
      const scaleY = wrapperHeight / originalHeight
      const scale = Math.min(scaleX, scaleY)

      // Calculate the scaled dimensions
      const scaledWidth = originalWidth * scale
      const scaledHeight = originalHeight * scale

      // Center the marquee container within the wrapper
      const offsetX = (wrapperWidth - scaledWidth) / 2
      const offsetY = (wrapperHeight - scaledHeight) / 2

      // Set fixed dimensions on the container
      marqueeContainer.style.width = `${originalWidth}px`
      marqueeContainer.style.height = `${originalHeight}px`

      // Apply scale and position to center
      marqueeContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
      marqueeContainer.style.transformOrigin = "top left"
    }

    updateScale()
    window.addEventListener("resize", updateScale)
    return () => window.removeEventListener("resize", updateScale)
  }, [responsive, viewBox])

  // Create an array of items outside of the render function
  const items = React.useMemo(() => {
    const childrenArray = React.Children.toArray(children)

    return childrenArray.flatMap((child, childIndex) =>
      Array.from({ length: repeat }, (_, repeatIndex) => {
        const itemIndex = repeatIndex * childrenArray.length + childIndex
        const key = `${childIndex}-${repeatIndex}`
        return {
          child,
          childIndex,
          repeatIndex,
          itemIndex,
          key,
        }
      })
    )
  }, [children, repeat])

  // Function to calculate z-index based on offset distance
  const calculateZIndex = useCallback(
    (offsetDistance: number) => {
      if (!enableRollingZIndex) {
        return undefined
      }

      // Simple progress-based z-index
      const normalizedDistance = offsetDistance / 100
      return Math.floor(zIndexBase + normalizedDistance * zIndexRange)
    },
    [enableRollingZIndex, zIndexBase, zIndexRange]
  )

  /* The published version generated this with `Math.random()` in the
     render body. Two problems, and ESLint flags the second: it produces
     a different id on every render, so the `<path id>` and the
     `offset-path` referencing it can disagree during an update; and an
     impure call in render breaks under any re-render React does on its
     own. `useId` is stable for the life of the component and unique
     across instances, which is exactly what an SVG id needs. */
  const generatedId = useId().replace(/:/g, '')
  const id = pathId || `marquee-path-${generatedId}`

  // Scroll tracking
  const { scrollY } = useScroll({
    container: (scrollContainer as RefObject<HTMLDivElement | null>) || container,
  })

  const scrollVelocity = useVelocity(scrollY)
  const smoothVelocity = useSpring(scrollVelocity, scrollSpringConfig)

  // Hover and drag state tracking
  const isHovered = useRef(false)
  const isDragging = useRef(false)
  const dragVelocity = useRef(0)

  // Direction factor for changing direction based on scroll or drag
  const directionFactor = useRef(direction === "normal" ? 1 : -1)

  // Motion values for animation
  const hoverFactorValue = useMotionValue(1)
  const defaultVelocity = useMotionValue(1)
  const smoothHoverFactor = useSpring(hoverFactorValue, slowDownSpringConfig)

  // Transform scroll velocity into a factor that affects marquee speed
  const velocityFactor = useTransform(
    useScrollVelocity ? smoothVelocity : defaultVelocity,
    [0, 1000],
    [0, 5],
    { clamp: false }
  )

  // Animation frame handler
  useAnimationFrame((_, delta) => {
    const before = baseOffset.get()
    tick(delta)
    if (delta > 0) velocity.set(((baseOffset.get() - before) * 1000) / delta)
  })

  function tick(delta: number) {
    if (isDragging.current && draggable) {
      baseOffset.set(baseOffset.get() + dragVelocity.current)

      // Add decay to dragVelocity
      dragVelocity.current *= 0.9

      // Stop completely if velocity is very small
      if (Math.abs(dragVelocity.current) < 0.01) {
        dragVelocity.current = 0
      }

      return
    }

    // Update hover factor
    if (isHovered.current) {
      hoverFactorValue.set(slowdownOnHover ? slowDownFactor : 1)
    } else {
      hoverFactorValue.set(1)
    }

    // Calculate regular movement
    let moveBy =
      directionFactor.current *
      baseVelocity *
      (delta / 1000) *
      smoothHoverFactor.get()

    // Adjust movement based on scroll velocity if scrollAwareDirection is enabled
    if (scrollAwareDirection && !isDragging.current) {
      if (velocityFactor.get() < 0) {
        directionFactor.current = -1
      } else if (velocityFactor.get() > 0) {
        directionFactor.current = 1
      }
    }

    moveBy += directionFactor.current * moveBy * velocityFactor.get()

    if (draggable) {
      moveBy += dragVelocity.current

      // Update direction based on drag direction if dragAwareDirection is true
      if (dragAwareDirection && Math.abs(dragVelocity.current) > 0.1) {
        directionFactor.current = Math.sign(dragVelocity.current)
      }

      // Gradually decay drag velocity back to zero
      if (!isDragging.current && Math.abs(dragVelocity.current) > 0.01) {
        dragVelocity.current *= dragVelocityDecay
      } else if (!isDragging.current) {
        dragVelocity.current = 0
      }
    }

    baseOffset.set(baseOffset.get() + moveBy)
  }

  // Pointer event handlers for dragging
  const lastPointerPosition = useRef({ x: 0, y: 0 })

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!draggable) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    if (grabCursor) {
      ;(e.currentTarget as HTMLElement).style.cursor = "grabbing"
    }

    isDragging.current = true
    lastPointerPosition.current = { x: e.clientX, y: e.clientY }

    // Pause automatic animation by setting velocity to 0
    dragVelocity.current = 0
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggable || !isDragging.current) return

    const currentPosition = { x: e.clientX, y: e.clientY }

    // Calculate movement delta - simplified for path movement
    const deltaX = currentPosition.x - lastPointerPosition.current.x
    const deltaY = currentPosition.y - lastPointerPosition.current.y

    // For path following, we use a simple magnitude of movement
    const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const projectedDelta = deltaX > 0 ? delta : -delta

    // Update drag velocity based on the projected movement
    dragVelocity.current = projectedDelta * dragSensitivity

    // Update last position
    lastPointerPosition.current = currentPosition
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggable) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    isDragging.current = false

    if (grabCursor) {
      ;(e.currentTarget as HTMLElement).style.cursor = "grab"
    }
  }

  return (
    <div
      ref={container}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn("relative", className)}
    >
      <div
        ref={marqueeContainerRef}
        className="relative"
        style={{ contain: "layout style" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={width}
          height={height}
          viewBox={viewBox}
          preserveAspectRatio={preserveAspectRatio}
          className="w-full h-full"
        >
          <path
            id={id}
            d={path}
            stroke={showPath ? "currentColor" : "none"}
            fill="none"
            ref={pathRef}
          />
        </svg>

        {items.map(({ child, repeatIndex, itemIndex, key }) => (
          <MarqueeItem
            key={key}
            itemKey={key}
            child={child}
            repeatIndex={repeatIndex}
            itemIndex={itemIndex}
            itemCount={items.length}
            baseOffset={baseOffset}
            velocity={velocity}
            easing={easing}
            path={path}
            draggable={draggable}
            grabCursor={grabCursor}
            enableRollingZIndex={enableRollingZIndex}
            calculateZIndex={calculateZIndex}
            cssVariableInterpolation={cssVariableInterpolation}
            itemRefs={itemRefs}
            isHoveredRef={isHovered}
            itemStyle={itemStyle}
          />
        ))}
      </div>
    </div>
  )
}

/* One item on the path.
 
   The published component called `useTransform`, `useMotionValue` and
   `useEffect` inside `items.map()`, which is a rules-of-hooks
   violation: React identifies hooks by call order, and a callback body
   is not a component. It happens to work here because the item count
   only changes when `children` or `repeat` change -- but "the list
   never reorders" is an assumption held in a different file from the
   code that depends on it, and the moment it stops being true the
   hooks silently pair up with the wrong state.
 
   Extracting the body into a real component is the standard fix and
   the only one that is actually correct. Each item now owns its own
   hooks, in its own render, in call order.
 
   `cssVariables` is the reason this could not simply be memoised in
   place: it called `useTransform` inside a `.map()` inside the
   callback, one hook per interpolated property. Here it is the same
   loop in a component, which is allowed because the property list is
   constant for the life of the component. */
function MarqueeItem({
  itemKey,
  child,
  repeatIndex,
  itemIndex,
  itemCount,
  baseOffset,
  velocity,
  easing,
  path,
  draggable,
  grabCursor,
  enableRollingZIndex,
  calculateZIndex,
  cssVariableInterpolation,
  itemRefs,
  /* Named `...Ref` deliberately. `react-hooks/immutability` treats a
     prop being assigned to as a mutated prop, which is a real rule with
     a real reason, and recognises a ref by the name. Renaming is the
     fix the rule itself suggests and is honest: it is a ref. */
  isHoveredRef,
  itemStyle,
}: {
  itemKey: string
  child: React.ReactNode
  repeatIndex: number
  itemIndex: number
  itemCount: number
  baseOffset: MotionValue<number>
  velocity: MotionValue<number>
  easing?: (value: number) => number
  path: string
  draggable?: boolean
  grabCursor?: boolean
  enableRollingZIndex?: boolean
  calculateZIndex: (offsetDistance: number) => number | undefined
  cssVariableInterpolation?: { property: string; from: number | string; to: number | string }[]
  itemRefs: RefObject<Map<string, HTMLDivElement>>
  isHoveredRef: RefObject<boolean>
  itemStyle?: React.CSSProperties
}) {
  const itemOffset = useTransform(baseOffset, (v) => {
    const position = (itemIndex * 100) / itemCount
    const wrappedValue = wrap(0, 100, v + position)
    return `${easing ? easing(wrappedValue / 100) * 100 : wrappedValue}%`
  })

  const currentOffsetDistance = useMotionValue(0)

  const zIndex = useTransform(currentOffsetDistance, (value) => calculateZIndex(value))

  useEffect(() => {
    const unsubscribe = itemOffset.on("change", (value: string) => {
      const match = value.match(/^([\d.]+)%$/)
      if (match && match[1]) {
        currentOffsetDistance.set(parseFloat(match[1]))
      }
    })
    return unsubscribe
  }, [itemOffset, currentOffsetDistance])

  const motionInfo = React.useMemo<MarqueeItemMotion>(
    () => ({ offset: currentOffsetDistance, velocity, travelled: baseOffset, index: itemIndex }),
    [currentOffsetDistance, velocity, baseOffset, itemIndex]
  )

  const cssVariables = Object.fromEntries(
    (cssVariableInterpolation || []).map(({ property, from, to }) => [
      property,
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useTransform(currentOffsetDistance, [0, 100], [from, to]),
    ])
  )

  return (
    <motion.div
      ref={(el) => {
        if (el) itemRefs.current.set(itemKey, el)
      }}
      className={cn("absolute top-0 left-0", draggable && grabCursor && "cursor-grab")}
      style={{
        offsetPath: `path('${path}')`,
        offsetDistance: itemOffset,
        zIndex: enableRollingZIndex ? zIndex : undefined,
        willChange: "offset-distance",
        backfaceVisibility: "hidden",
        ...cssVariables,
        ...itemStyle,
      }}
      aria-hidden={repeatIndex > 0}
      onMouseEnter={() => (isHoveredRef.current = true)}
      onMouseLeave={() => (isHoveredRef.current = false)}
    >
      <ItemContext.Provider value={motionInfo}>{child}</ItemContext.Provider>
    </motion.div>
  )
}

export default MarqueeAlongSvgPath
