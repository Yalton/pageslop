import type { Metadata } from "next"
import {
  LegalArticle,
  LegalCode,
  LegalLink,
  LegalList,
  LegalSection,
  LegalTitle,
} from "@/components/legal/LegalProse"

export const metadata: Metadata = {
  title: "Privacy Policy",
}

export default function PrivacyPage() {
  return (
    <LegalArticle>
      <LegalTitle updated="Last updated: March 2026">Privacy Policy</LegalTitle>

      <LegalSection title="What we collect">
        <p>
          Pageslop collects the minimum data needed to provide the service:
        </p>
        <LegalList>
          <li><strong>Account information</strong> — your name, email address, and a hashed password.</li>
          <li><strong>Saved links</strong> — URLs you save, along with page titles, descriptions, and images fetched from those pages.</li>
          <li><strong>Tags and classifications</strong> — auto-generated and user-edited metadata about your links.</li>
          <li><strong>API keys</strong> — if you provide an Anthropic API key, it is encrypted at rest (AES-256-GCM) and never exposed after saving.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="How we use your data">
        <LegalList>
          <li>To provide and improve the bookmark management service.</li>
          <li>To send transactional emails (verification, password reset) via our email provider.</li>
          <li>To make LLM API calls on your behalf using your own API key (if provided). Your key is decrypted server-side only for this purpose.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="What we don't do">
        <LegalList>
          <li>We don&apos;t sell your data.</li>
          <li>We don&apos;t use your data for advertising.</li>
          <li>We don&apos;t share your data with third parties except as needed to operate the service (email delivery, database hosting).</li>
          <li>We don&apos;t track you across other websites.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Data storage">
        <p>
          Your data is stored in a PostgreSQL database. Passwords are hashed with scrypt. API keys are encrypted with AES-256-GCM. We use standard security practices to protect your information.
        </p>
      </LegalSection>

      <LegalSection title="Data deletion">
        <p>
          You can delete individual links from your dashboard. To delete your entire account and all associated data, contact us at the email below.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use a single session cookie (<LegalCode>better-auth.session_token</LegalCode>) to keep you logged in. No tracking cookies or analytics scripts.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about privacy? Email <LegalLink href="mailto:dalton@citreum.com">dalton@citreum.com</LegalLink>.
        </p>
      </LegalSection>
    </LegalArticle>
  )
}
