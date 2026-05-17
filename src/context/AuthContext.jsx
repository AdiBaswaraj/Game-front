import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import { profileNameFor } from '../lib/profile'
import AuthModal from '../components/AuthModal'
import UsernamePromptModal from '../components/UsernamePromptModal'

const AuthContext = createContext(null)
const GUEST_KEY = 'arcadia:guest'

function generateGuestName() {
  const n = Math.floor(1000 + Math.random() * 9000)
  return `Player_${n}`
}

async function upsertProfile(user) {
  const username = profileNameFor(user)
  const avatar_url =
    user.user_metadata?.avatar_url || user.user_metadata?.picture || null
  try {
    // Insert a row for first-time users; never overwrite an existing
    // row, which would clobber a username the user already chose.
    // UsernamePromptModal owns updates from here on.
    await supabase
      .from('profiles')
      .upsert(
        { id: user.id, username, avatar_url },
        { onConflict: 'id', ignoreDuplicates: true },
      )
  } catch {
    // profile upsert is best-effort — auth still works
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [guestName, setGuestName] = useState(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(GUEST_KEY),
  )
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState('login')
  const lastUserIdRef = useRef(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      lastUserIdRef.current = data.session?.user?.id ?? null
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        setSession(nextSession)
        setUser(nextSession?.user ?? null)

        if (event === 'SIGNED_IN' && nextSession?.user) {
          const isNewLogin = lastUserIdRef.current !== nextSession.user.id
          lastUserIdRef.current = nextSession.user.id
          localStorage.removeItem(GUEST_KEY)
          setGuestName(null)
          if (isNewLogin) await upsertProfile(nextSession.user)
        }

        if (event === 'SIGNED_OUT') {
          lastUserIdRef.current = null
        }
      },
    )

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const continueAsGuest = useCallback(() => {
    const name = generateGuestName()
    localStorage.setItem(GUEST_KEY, name)
    setGuestName(name)
    setModalOpen(false)
  }, [])

  const signOut = useCallback(async () => {
    if (user) await supabase.auth.signOut()
    localStorage.removeItem(GUEST_KEY)
    setGuestName(null)
    // Wipe per-user game state so the next session in this browser
    // starts clean: daily Word Puzzle state, local "best" mirrors,
    // username-prompt flags, and outgoing-friend-request hints.
    try {
      const remove = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k) continue
        if (
          k.startsWith('arcadia:wordpuzzle:') ||
          k.startsWith('arcadia:highscore:') ||
          k.startsWith('arcadia:bestTime:') ||
          k.startsWith('arcadia:usernamePrompted:')
        ) {
          remove.push(k)
        }
      }
      remove.forEach((k) => localStorage.removeItem(k))
    } catch {
      // private mode or full storage — ignore
    }
  }, [user])

  const openLogin = useCallback(() => {
    setModalTab('login')
    setModalOpen(true)
  }, [])

  const openSignup = useCallback(() => {
    setModalTab('signup')
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => setModalOpen(false), [])

  const isGuest = !user && !!guestName
  const displayName = user ? profileNameFor(user) : guestName

  const value = {
    user,
    session,
    isGuest,
    guestName,
    displayName,
    loading,
    signOut,
    continueAsGuest,
    openLogin,
    openSignup,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal open={modalOpen} initialTab={modalTab} onClose={closeModal} />
      <UsernamePromptModal />
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
