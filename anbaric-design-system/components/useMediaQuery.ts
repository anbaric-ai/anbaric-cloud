import { useEffect, useState } from 'react'

/**
 * Whether a media query currently matches, kept current as the viewport
 * changes. False on the server and until the first render on the client, so a
 * component renders its wide form by default and narrows once it knows.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}
