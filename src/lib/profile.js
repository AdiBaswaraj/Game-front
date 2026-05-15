export function profileNameFor(user) {
  if (!user) return null
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : null) ||
    'Player'
  )
}
