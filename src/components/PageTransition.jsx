import { useLocation } from 'react-router-dom'

// Wraps the route tree. Keying on location.pathname forces React to
// remount the child subtree on every navigation, which restarts the
// pageEnter animation. The wrapper itself paints no UI.
export default function PageTransition({ children }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  )
}
