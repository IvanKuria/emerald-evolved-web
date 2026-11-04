import { useEffect, useState } from 'react'
import { SITE } from '../lib/site'

/* "Star on GitHub" beside the hero's Play button. The live count shows once it is worth showing (20+); a small
   number reads as nobody cares. Cached per tab so the API's 60-requests-an-hour limit is never near. */
const SHOW_FROM = 20
const KEY = 'ee-stars'

export function GitHubStar({ className = '' }: { className?: string }) {
  const [stars, setStars] = useState<number | null>(() => {
    try {
      const v = sessionStorage.getItem(KEY)
      return v ? Number(v) : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (stars !== null) return
    const repo = SITE.github.replace('https://github.com/', '')
    fetch(`https://api.github.com/repos/${repo}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (typeof j?.stargazers_count !== 'number') return
        setStars(j.stargazers_count)
        try {
          sessionStorage.setItem(KEY, String(j.stargazers_count))
        } catch {
          /* private mode */
        }
      })
      .catch(() => {})
  }, [stars])

  return (
    <a href={SITE.github} target="_blank" rel="noopener noreferrer" className={`btn btn-quiet ${className}`}>
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      Star on GitHub
      {stars !== null && stars >= SHOW_FROM && (
        <span className="tabular-nums text-ash" aria-label={`${stars} stars`}>
          {stars.toLocaleString()}
        </span>
      )}
    </a>
  )
}
