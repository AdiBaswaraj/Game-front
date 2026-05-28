import LegalShell, { List, Section } from './LegalShell'

export default function PrivacyPage() {
  return (
    <LegalShell title="PRIVACY POLICY" lastUpdated="JUNE 2026">
      <Section number="1" title="Information We Collect">
        <List
          items={[
            'Account information: email address, username you choose',
            'Game data: scores, game history, win/loss records',
            'Usage data: pages visited, games played (anonymized)',
            'We do NOT collect: payment info, real name, location',
          ]}
        />
      </Section>

      <Section number="2" title="How We Use Your Information">
        <List
          items={[
            'To operate your account and display your scores',
            'To show leaderboards to other players',
            'To enable multiplayer matchmaking and friend features',
            'We do NOT sell your data to third parties',
          ]}
        />
      </Section>

      <Section number="3" title="Data Storage">
        <List
          items={[
            'Data stored securely via Supabase (PostgreSQL)',
            'Servers located in United States (us-west-1)',
            'Account data retained until you delete your account',
          ]}
        />
      </Section>

      <Section number="4" title="Third Party Services">
        <List
          items={[
            <>
              Supabase: database and authentication (
              <ExternalLink href="https://supabase.com/privacy">
                supabase.com/privacy
              </ExternalLink>
              )
            </>,
            <>
              Google OAuth: if you sign in with Google (
              <ExternalLink href="https://policies.google.com/privacy">
                policies.google.com/privacy
              </ExternalLink>
              )
            </>,
            <>
              Vercel: website hosting (
              <ExternalLink href="https://vercel.com/legal/privacy-policy">
                vercel.com/legal/privacy-policy
              </ExternalLink>
              )
            </>,
          ]}
        />
      </Section>

      <Section number="5" title="Your Rights">
        <List
          items={[
            'Access your data: view profile and scores in-app',
            'Delete your account: email us or use account settings',
            'Data portability: request a copy of your data by email',
          ]}
        />
      </Section>

      <Section number="6" title="Contact">
        <List
          items={[
            'For privacy concerns: privacy@arcadia.example',
            'Response within 5 business days',
          ]}
        />
      </Section>
    </LegalShell>
  )
}

function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-neon-cyan transition hover:text-neon-green"
    >
      {children}
    </a>
  )
}
