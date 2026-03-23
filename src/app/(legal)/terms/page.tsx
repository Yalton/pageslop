import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service",
}

export default function TermsPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: March 2026</p>

      <h2>The service</h2>
      <p>
        Pageslop is a free bookmark manager that saves, classifies, and organizes your links. By using Pageslop, you agree to these terms.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide a valid email address to create an account.</li>
        <li>You are responsible for keeping your password secure.</li>
        <li>One account per person. Don&apos;t share your login credentials.</li>
      </ul>

      <h2>Your content</h2>
      <ul>
        <li>You own the links and metadata you save. We don&apos;t claim ownership of your data.</li>
        <li>You can export your data at any time via the Settings page.</li>
        <li>Don&apos;t use Pageslop to store illegal content or links to illegal material.</li>
      </ul>

      <h2>BYOK (Bring Your Own Key)</h2>
      <ul>
        <li>If you provide an Anthropic API key, we use it solely to enhance your link classifications.</li>
        <li>API usage charges are billed directly to your Anthropic account, not through us.</li>
        <li>We encrypt your key at rest and never expose it after saving.</li>
      </ul>

      <h2>The service is provided &quot;as is&quot;</h2>
      <p>
        Pageslop is free and provided without warranty. We do our best to keep the service running and your data safe, but we can&apos;t guarantee 100% uptime or zero data loss.
      </p>

      <h2>We may</h2>
      <ul>
        <li>Update these terms with reasonable notice.</li>
        <li>Suspend accounts that violate these terms.</li>
        <li>Shut down the service with 30 days notice and an opportunity to export your data.</li>
      </ul>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Pageslop and its operators are not liable for any indirect, incidental, or consequential damages arising from your use of the service.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href="mailto:dalton@citreum.com">dalton@citreum.com</a>.
      </p>
    </article>
  )
}
