/* frame-site's `cn`, without tailwind-merge: the components that use it
   here never pass conflicting utilities, so joining is all it has to do. */
export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')
