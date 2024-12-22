'use client'

import { RefObject, useEffect, useId, useState } from 'react'
import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

export interface AnimatedBeamProps {
  className?: string
  containerRef: RefObject<HTMLElement> // Container ref
  fromRef: RefObject<HTMLElement>
  toRef: RefObject<HTMLElement>
  curvature?: number
  reverse?: boolean
  pathColor?: string
  pathWidth?: number
  pathOpacity?: number
  gradientStartColor?: string
  gradientStopColor?: string
  delay?: number
  duration?: number
  startXOffset?: number
  startYOffset?: number
  endXOffset?: number
  endYOffset?: number
}

export const AnimatedBeam: React.FC<AnimatedBeamProps> = ({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false, // Include the reverse prop
  duration = Math.random() * 3 + 4,
  delay = 0,
  pathColor = 'gray',
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = '#ffaa40',
  gradientStopColor = '#9c40ff',
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0
}) => {
  const initialId = useId()
  const [id, setId] = useState(initialId)
  const [pathD, setPathD] = useState('')
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updatePath = () => {
      if (!containerRef.current || !fromRef.current || !toRef.current) {
        return
      }

      const containerRect = containerRef.current.getBoundingClientRect()
      const rectA = fromRef.current.getBoundingClientRect()
      const rectB = toRef.current.getBoundingClientRect()

      const svgWidth = containerRect.width
      const svgHeight = containerRect.height

      setSvgDimensions({ width: svgWidth, height: svgHeight })

      const startX = rectA.left - containerRect.left + rectA.width / 2 + startXOffset
      const startY = rectA.top - containerRect.top + rectA.height + startYOffset
      const endX = rectB.left - containerRect.left + rectB.width / 2 + endXOffset
      const endY = rectB.top - containerRect.top + endYOffset

      const midY = (startY + endY) / 2

      const d = `M ${startX},${startY} V ${midY} H ${endX} V ${endY}`
      setPathD(d)
    }

    // Initialize ResizeObserver
    const resizeObserver = new ResizeObserver(entries => {
      // For all entries, recalculate the path
      for (let entry of entries) {
        updatePath()
      }
    })

    // Observe the container element
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Call the updatePath initially to set the initial path
    updatePath()

    // Clean up the observer on component unmount
    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset])

  const colors = {
    motionMagenta: '#f08',
    motionPurple: '#4f46e5'
  }

  return (
    <motion.svg
      fill="none"
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      className={cn('pointer-events-none absolute left-0 top-0 transform-gpu stroke-2', className)}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
    >
      <defs>
        <linearGradient id="initialColor">
          <stop offset="0%" stopColor={colors.motionMagenta} />
          <stop offset="100%" stopColor={colors.motionPurple} />
        </linearGradient>
      </defs>
      <path
        strokeDasharray="4"
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />

      <motion.path
        d={pathD}
        initial={{
          stroke: 'url(#initialColor)',
          pathLength: 0,
          pathOffset: 0,
          pathSpacing: 1,
          opacity: 0.5
        }}
        animate={{
          pathLength: 0.05,
          pathOffset: 1,
          pathSpacing: 1,
          opacity: 0.5
        }}
        transition={{
          delay,
          duration,
          ease: 'easeIn', // https://easings.net/#easeOutExpo
          repeat: Infinity,
          repeatDelay: 0
        }}
        style={{ fill: 'transparent', strokeWidth: pathWidth, strokeLinecap: 'round' }}
      />
    </motion.svg>
  )
}
