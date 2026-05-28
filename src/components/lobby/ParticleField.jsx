import { useEffect, useRef } from 'react'

const COLORS = ['#00ff88', '#00d4ff', '#ff006e', '#7000ff']
const COLOR_RGB = COLORS.map((hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
})

function pickColorIndex() {
  const r = Math.random()
  if (r < 0.5) return 0
  if (r < 0.75) return 1
  if (r < 0.9) return 2
  return 3
}

function pickType() {
  const r = Math.random()
  if (r < 0.6) return 'dot'
  if (r < 0.9) return 'pixel'
  return 'cross'
}

const LINK_DIST = 120
const LINK_DIST2 = LINK_DIST * LINK_DIST

export default function ParticleField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId = 0
    let particles = []
    let viewW = 0
    let viewH = 0
    const isMobile = window.innerWidth < 768
    const COUNT = isMobile ? 40 : 80

    const initParticles = () => {
      particles = Array.from({ length: COUNT }, () => {
        const type = pickType()
        const size =
          type === 'dot' ? 1 + Math.random() * 2 : type === 'pixel' ? 4 : 6
        const ci = pickColorIndex()
        return {
          x: Math.random() * viewW,
          y: Math.random() * viewH,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          size,
          baseOpacity: 0.1 + Math.random() * 0.4,
          phase: Math.random() * Math.PI * 2,
          speed: 0.0005 + Math.random() * 0.001,
          rgb: COLOR_RGB[ci],
          type,
        }
      })
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      viewW = window.innerWidth
      viewH = window.innerHeight
      canvas.width = viewW * dpr
      canvas.height = viewH * dpr
      canvas.style.width = `${viewW}px`
      canvas.style.height = `${viewH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (particles.length === 0) initParticles()
    }

    const tick = (t) => {
      ctx.clearRect(0, 0, viewW, viewH)

      // Update positions (wrap on edges)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        if (p.x < -10) p.x = viewW + 10
        else if (p.x > viewW + 10) p.x = -10
        if (p.y < -10) p.y = viewH + 10
        else if (p.y > viewH + 10) p.y = -10
      }

      // Connection lines (neon-green network)
      ctx.lineWidth = 1
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d2 = dx * dx + dy * dy
          if (d2 < LINK_DIST2) {
            const d = Math.sqrt(d2)
            const op = (1 - d / LINK_DIST) * 0.15
            ctx.strokeStyle = `rgba(0,255,136,${op.toFixed(3)})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      // Draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const opacity = Math.max(
          0,
          Math.min(
            1,
            p.baseOpacity + Math.sin(t * p.speed + p.phase) * 0.2,
          ),
        )
        const [r, g, b] = p.rgb
        ctx.fillStyle = `rgba(${r},${g},${b},${opacity.toFixed(3)})`
        if (p.type === 'dot') {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        } else if (p.type === 'pixel') {
          ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
        } else {
          ctx.fillRect(p.x - 3, p.y - 1, 6, 2)
          ctx.fillRect(p.x - 1, p.y - 3, 2, 6)
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    const start = () => {
      if (rafId) return
      rafId = requestAnimationFrame(tick)
    }
    const stop = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }
    const onVis = () => {
      if (document.hidden) stop()
      else start()
    }

    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVis)
    start()

    return () => {
      stop()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{ willChange: 'transform', zIndex: 0 }}
    />
  )
}
