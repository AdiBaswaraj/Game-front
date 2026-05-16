import { useEffect } from 'react'

const SUFFIX = 'ARCADIA'

export function useDocumentTitle(title) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${SUFFIX} — ${title}` : SUFFIX
    return () => {
      document.title = prev
    }
  }, [title])
}
