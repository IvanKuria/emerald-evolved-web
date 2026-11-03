import * as motion from 'motion/react-client'
import type { ReactNode } from 'react'

/* Scroll entrance, using Motion's own `whileInView` rather than a
   hand-rolled observer.

   Two earlier versions of this were written from scratch and both
   shipped the same bug in different clothes: the hidden state was the
   default and the animation was what rescued it, so any render where
   the rescue did not arrive was a blank section. Motion has solved
   this properly, `once` included, and there was no reason to be
   writing observer code on a marketing site.

   `once` because a section that re-fades every time it scrolls past is
   a section you cannot skim back through. `amount: 0.15` so a tall
   block starts as soon as a sixth of it is showing instead of waiting
   to be fully on screen. Motion respects reduced motion globally. */

export function Rise({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'section' | 'article' | 'header'
}) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Tag>
  )
}
