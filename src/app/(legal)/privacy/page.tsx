import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy",
}

export default function PrivacyPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: March 2026</p>

      <h2>What we collect</h2>
      <p>
        Pageslop collects the minimum data needed to provide the service:
      </p>
      <ul>
        <li><strong>Account information</strong> — your name, email address, and a hashed password.</li>
        <li><strong>Saved links</strong> — URLs you save, along with page titles, descriptions, and images fetched from those pages.</li>
        <li><strong>Tags and classifications</strong> — auto-generated and user-edited metadata about your links.</li>
        <li><strong>API keys</strong> — if you provide an Anthropic API key, it is encrypted at rest (AES-256-GCM) and never exposed after saving.</li>
      </ul>

      <h2>How we use your data</h2>
      <ul>
        <li>To provide and improve the bookmark management service.</li>
        <li>To send transactional emails (verification, password reset) via our email provider.</li>
        <li>To make LLM API calls on your behalf using your own API key (if provided). Your key is decrypted server-side only for this purpose.</li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data.</li>
        <li>We don&apos;t use your data for advertising.</li>
        <li>We don&apos;t share your data with third parties except as needed to operate the service (email delivery, database hosting).</li>
        <li>We don&apos;t track you across other websites.</li>
      </ul>

      <h2>Data storage</h2>
      <p>
        Your data is stored in a PostgreSQL database. Passwords are hashed with scrypt. API keys are encrypted with AES-256-GCM. We use standard security practices to protect your information.
      </p>

      <h2>Data deletion</h2>
      <p>
        You can delete individual links from your dashboard. To delete your entire account and all associated data, contact us at the email below.
      </p>

      <h2>Cookies</h2>
      <p>
        We use a single session cookie (<code>better-auth.session_token</code>) to keep you logged in. No tracking cookies or analytics scripts.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? Email <a href="mailto:dalton@citreum.com">dalton@citreum.com</a>.
      </p>
    </article>
  )
}
