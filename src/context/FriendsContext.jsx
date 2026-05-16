import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { socket } from '../lib/socket'
import {
  acceptFriendRequest as apiAcceptFriendRequest,
  getFriends as apiGetFriends,
  getPendingRequests as apiGetPendingRequests,
  removeFriend as apiRemoveFriend,
  sendFriendRequest as apiSendFriendRequest,
} from '../lib/api'
import FriendsDrawer from '../components/FriendsDrawer'
import GameInviteBanner from '../components/GameInviteBanner'
import InviteGameModal from '../components/InviteGameModal'

const FriendsContext = createContext(null)

function pickField(o, ...keys) {
  for (const k of keys) {
    if (o && o[k] != null) return o[k]
  }
  return undefined
}

function normalizeFriend(raw) {
  return {
    userId: pickField(raw, 'userId', 'user_id', 'id'),
    username: pickField(raw, 'username', 'name') ?? 'Player',
    isOnline: !!pickField(raw, 'isOnline', 'is_online', 'online'),
    friendshipId: pickField(raw, 'friendshipId', 'friendship_id'),
    avatar_url: pickField(raw, 'avatar_url', 'avatarUrl'),
  }
}

function normalizeRequest(raw) {
  return {
    userId: pickField(raw, 'requesterId', 'requester_id', 'userId', 'user_id'),
    username:
      pickField(raw, 'requesterUsername', 'requester_username', 'username') ??
      'Player',
    friendshipId: pickField(raw, 'friendshipId', 'friendship_id', 'id'),
    avatar_url: pickField(raw, 'avatar_url'),
  }
}

export function FriendsProvider({ children }) {
  const { user, displayName } = useAuth()
  const toast = useToast()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [inviteFriend, setInviteFriend] = useState(null) // for outgoing-invite modal
  const [incomingInvite, setIncomingInvite] = useState(null) // for banner

  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [pendingSent, setPendingSent] = useState(() => new Set()) // outgoing usernames
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [requestsLoading, setRequestsLoading] = useState(false)

  // Connect socket + emit user_connected when user logs in
  useEffect(() => {
    if (!user) {
      if (socket.connected) socket.disconnect()
      return
    }
    if (!socket.connected) socket.connect()
    const announce = () =>
      socket.emit('user_connected', {
        userId: user.id,
        username: displayName,
      })
    if (socket.connected) announce()
    socket.on('connect', announce)
    return () => {
      socket.off('connect', announce)
    }
  }, [user, displayName])

  // Listen for friend / invite events
  useEffect(() => {
    if (!user) return

    const onFriendOnline = ({ userId, username }) => {
      setFriends((prev) => {
        const exists = prev.some((f) => f.userId === userId)
        if (exists) {
          return prev.map((f) =>
            f.userId === userId ? { ...f, isOnline: true } : f,
          )
        }
        // Brand-new friend just accepted us — add them
        return [
          ...prev,
          { userId, username: username ?? 'Player', isOnline: true },
        ]
      })
    }
    const onFriendOffline = ({ userId }) => {
      setFriends((prev) =>
        prev.map((f) =>
          f.userId === userId ? { ...f, isOnline: false } : f,
        ),
      )
    }
    const onInviteReceived = (data) => {
      setIncomingInvite({
        roomCode: data?.roomCode,
        gameId: data?.gameId,
        fromUsername: data?.fromUsername,
        fromUserId: data?.fromUserId ?? data?.from_user_id,
      })
    }
    const onInviteDeclined = ({ fromUsername }) => {
      toast.show({
        message: `${fromUsername ?? 'Friend'} declined your invite.`,
        duration: 4000,
      })
    }
    const onInviteFailed = ({ message }) => {
      toast.show({
        message: message ?? 'Invite failed.',
        duration: 4000,
      })
    }

    socket.on('friend_online', onFriendOnline)
    socket.on('friend_offline', onFriendOffline)
    socket.on('friend_invite_received', onInviteReceived)
    socket.on('invite_declined', onInviteDeclined)
    socket.on('invite_failed', onInviteFailed)
    return () => {
      socket.off('friend_online', onFriendOnline)
      socket.off('friend_offline', onFriendOffline)
      socket.off('friend_invite_received', onInviteReceived)
      socket.off('invite_declined', onInviteDeclined)
      socket.off('invite_failed', onInviteFailed)
    }
  }, [user, toast])

  const refreshFriends = useCallback(async () => {
    if (!user) return
    setFriendsLoading(true)
    try {
      const raw = await apiGetFriends(user.id)
      setFriends(raw.map(normalizeFriend))
    } catch {
      // logged in api.js
    } finally {
      setFriendsLoading(false)
    }
  }, [user])

  const refreshPending = useCallback(async () => {
    if (!user) return
    setRequestsLoading(true)
    try {
      const raw = await apiGetPendingRequests(user.id)
      setPendingRequests(raw.map(normalizeRequest))
    } catch {
      // logged in api.js
    } finally {
      setRequestsLoading(false)
    }
  }, [user])

  // Initial fetch + refetch on auth change
  useEffect(() => {
    if (!user) {
      setFriends([])
      setPendingRequests([])
      setPendingSent(new Set())
      return
    }
    refreshFriends()
    refreshPending()
  }, [user, refreshFriends, refreshPending])

  const sendRequest = useCallback(
    async (addresseeUsername) => {
      if (!user) return
      try {
        await apiSendFriendRequest(user.id, addresseeUsername)
        setPendingSent((prev) => {
          const next = new Set(prev)
          next.add(addresseeUsername)
          return next
        })
        toast.show({
          message: `Request sent to ${addresseeUsername}.`,
          duration: 3000,
        })
      } catch (err) {
        toast.show({
          message: err.status === 409 ? 'Request already exists.' : 'Could not send request.',
          duration: 3000,
        })
      }
    },
    [toast, user],
  )

  const acceptRequest = useCallback(
    async (request) => {
      if (!user || !request?.friendshipId) return
      try {
        await apiAcceptFriendRequest(user.id, request.friendshipId)
        setPendingRequests((prev) =>
          prev.filter((r) => r.friendshipId !== request.friendshipId),
        )
        await refreshFriends()
        toast.show({
          message: `Now friends with ${request.username}.`,
          duration: 3000,
        })
      } catch {
        toast.show({ message: 'Could not accept request.', duration: 3000 })
      }
    },
    [refreshFriends, toast, user],
  )

  const declineOrRemove = useCallback(
    async (friendshipId, label) => {
      if (!user || !friendshipId) return
      try {
        await apiRemoveFriend(user.id, friendshipId)
        setPendingRequests((prev) =>
          prev.filter((r) => r.friendshipId !== friendshipId),
        )
        setFriends((prev) =>
          prev.filter((f) => f.friendshipId !== friendshipId),
        )
        if (label) {
          toast.show({ message: label, duration: 2500 })
        }
      } catch {
        toast.show({ message: 'Could not complete.', duration: 3000 })
      }
    },
    [toast, user],
  )

  const isAlreadyFriend = useCallback(
    (username) =>
      !!friends.find(
        (f) => f.username?.toLowerCase() === username?.toLowerCase(),
      ),
    [friends],
  )

  const isPendingOutgoing = useCallback(
    (username) => pendingSent.has(username),
    [pendingSent],
  )

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const openInviteModal = useCallback((friend) => setInviteFriend(friend), [])
  const closeInviteModal = useCallback(() => setInviteFriend(null), [])
  const dismissIncomingInvite = useCallback(
    () => setIncomingInvite(null),
    [],
  )

  const value = useMemo(
    () => ({
      drawerOpen,
      friends,
      friendsLoading,
      pendingRequests,
      requestsLoading,
      incomingInvite,
      inviteFriend,
      refreshFriends,
      refreshPending,
      sendRequest,
      acceptRequest,
      declineOrRemove,
      isAlreadyFriend,
      isPendingOutgoing,
      openDrawer,
      closeDrawer,
      openInviteModal,
      closeInviteModal,
      dismissIncomingInvite,
    }),
    [
      drawerOpen,
      friends,
      friendsLoading,
      pendingRequests,
      requestsLoading,
      incomingInvite,
      inviteFriend,
      refreshFriends,
      refreshPending,
      sendRequest,
      acceptRequest,
      declineOrRemove,
      isAlreadyFriend,
      isPendingOutgoing,
      openDrawer,
      closeDrawer,
      openInviteModal,
      closeInviteModal,
      dismissIncomingInvite,
    ],
  )

  return (
    <FriendsContext.Provider value={value}>
      {children}
      {user && <FriendsDrawer />}
      {user && <InviteGameModal />}
      {user && <GameInviteBanner />}
    </FriendsContext.Provider>
  )
}

export function useFriends() {
  const ctx = useContext(FriendsContext)
  if (!ctx) throw new Error('useFriends must be used within FriendsProvider')
  return ctx
}
