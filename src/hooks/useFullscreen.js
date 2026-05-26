import { useCallback, useEffect, useState } from 'react'

function isEnabled() {
  if (typeof document === 'undefined') return false
  return !!(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled
  )
}

function currentEl() {
  if (typeof document === 'undefined') return null
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    null
  )
}

export function useFullscreen() {
  const [supported, setSupported] = useState(isEnabled())
  const [isFullscreen, setIsFullscreen] = useState(!!currentEl())

  const enter = useCallback(() => {
    const el = document.documentElement
    try {
      if (el.requestFullscreen) el.requestFullscreen()
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen()
    } catch (err) {
      console.warn('[fullscreen] enter failed', err)
    }
  }, [])

  const exit = useCallback(() => {
    try {
      if (document.exitFullscreen) document.exitFullscreen()
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
      else if (document.mozCancelFullScreen) document.mozCancelFullScreen()
    } catch (err) {
      console.warn('[fullscreen] exit failed', err)
    }
  }, [])

  const toggle = useCallback(() => {
    if (currentEl()) exit()
    else enter()
  }, [enter, exit])

  useEffect(() => {
    setSupported(isEnabled())
    const onChange = () => setIsFullscreen(!!currentEl())
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    document.addEventListener('mozfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      document.removeEventListener('mozfullscreenchange', onChange)
    }
  }, [])

  // F key toggles fullscreen globally — except when typing into a
  // form field. Games shouldn't need to register this themselves.
  useEffect(() => {
    if (!supported) return
    const handler = (e) => {
      if (e.key !== 'f' && e.key !== 'F') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (document.activeElement?.tagName ?? '').toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [supported, toggle])

  return { isFullscreen, toggle, enter, exit, supported }
}
