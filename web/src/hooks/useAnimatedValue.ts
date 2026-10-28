/**
 * Hook para animar um valor numérico de um estado anterior para o novo.
 * Easing: ease-out cúbico, 450ms. Respeita prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from 'react'

export function useAnimatedValue(target: number, duration = 450): number {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  const rafRef  = useRef<number>(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = prevRef.current
    prevRef.current = target

    if (prefersReduced || from === target) {
      setDisplay(target)
      return
    }

    const start = performance.now()
    const animate = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const e = 1 - Math.pow(1 - p, 3)           // ease-out cubic
      setDisplay(from + (target - from) * e)
      if (p < 1) rafRef.current = requestAnimationFrame(animate)
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return display
}
