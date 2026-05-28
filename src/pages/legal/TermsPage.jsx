import LegalShell, { List, Section } from './LegalShell'

export default function TermsPage() {
  return (
    <LegalShell title="TERMS OF SERVICE" lastUpdated="JUNE 2026">
      <Section number="1" title="Acceptance">
        <p>By using Arcadia you agree to these terms.</p>
        <p>Must be 13+ years old to create an account.</p>
      </Section>

      <Section number="2" title="User Accounts">
        <List
          items={[
            'You are responsible for your account security',
            'One account per person',
            'Do not share accounts',
            'We may suspend accounts that violate these terms',
          ]}
        />
      </Section>

      <Section number="3" title="Acceptable Use">
        <p>You agree NOT to:</p>
        <List
          items={[
            'Cheat, hack, or exploit game vulnerabilities',
            'Harass other players',
            'Use bots or automated scripts',
            "Attempt to access other users' accounts",
            'Reverse engineer the platform',
          ]}
        />
      </Section>

      <Section number="4" title="Game Rules">
        <List
          items={[
            'Scores achieved through exploits will be removed',
            'Repeated cheating results in permanent ban',
            'Play fair and have fun',
          ]}
        />
      </Section>

      <Section number="5" title="Intellectual Property">
        <List
          items={[
            'Arcadia platform, design, and code: our property',
            'Classic game rules (Chess, Minesweeper etc): public domain',
            'Your username and scores: remain yours',
          ]}
        />
      </Section>

      <Section number="6" title="Disclaimers">
        <List
          items={[
            'Service provided "as is" without warranty',
            'We may modify or discontinue features at any time',
            'Not responsible for data loss during outages',
          ]}
        />
      </Section>

      <Section number="7" title="Contact">
        <p>support@arcadia.example</p>
      </Section>
    </LegalShell>
  )
}
