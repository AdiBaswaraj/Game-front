import LegalShell, { List } from './LegalShell'

export default function CookiesPage() {
  return (
    <LegalShell title="COOKIE POLICY" lastUpdated="JUNE 2026">
      <p>We use minimal cookies and local storage:</p>
      <List
        items={[
          'Session cookie: keeps you logged in (essential)',
          'Preference storage: game settings, dark mode (localStorage)',
          'No advertising cookies',
          'No third-party tracking cookies',
        ]}
      />
      <p>
        You can clear cookies and localStorage in your browser settings. This
        will log you out and reset your game preferences.
      </p>
    </LegalShell>
  )
}
