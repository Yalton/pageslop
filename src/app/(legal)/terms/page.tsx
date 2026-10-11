import type { Metadata } from "next"
import {
  LegalArticle,
  LegalLink,
  LegalList,
  LegalSection,
  LegalTitle,
} from "@/components/legal/LegalProse"

export const metadata: Metadata = {
  title: "Terms of Service",
}

export default function TermsPage() {
  return (
    <LegalArticle>
      <LegalTitle updated="Last updated: March 2026">Terms of Service</LegalTitle>

      <LegalSection title="The service">
        <p>
          Pageslop is a free bookmark manager that saves, classifies, and organizes your links. By using Pageslop, you agree to these terms.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <LegalList>
          <li>You must provide a valid email address to create an account.</li>
          <li>You are responsible for keeping your password secure.</li>
          <li>One account per person. Don&apos;t share your login credentials.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Your content">
        <LegalList>
          <li>You own the links and metadata you save. We don&apos;t claim ownership of your data.</li>
          <li>You can export your data at any time via the Settings page.</li>
          <li>Don&apos;t use Pageslop to store illegal content or links to illegal material.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="BYOK (Bring Your Own Key)">
        <LegalList>
          <li>If you provide an Anthropic API key, we use it solely to enhance your link classifications.</li>
          <li>API usage charges are billed directly to your Anthropic account, not through us.</li>
          <li>We encrypt your key at rest and never expose it after saving.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title='The service is provided "as is"'>
        <p>
          Pageslop is free and provided without warranty. We do our best to keep the service running and your data safe, but we can&apos;t guarantee 100% uptime or zero data loss.
        </p>
      </LegalSection>

      <LegalSection title="We may">
        <LegalList>
          <li>Update these terms with reasonable notice.</li>
          <li>Suspend accounts that violate these terms.</li>
          <li>Shut down the service with 30 days notice and an opportunity to export your data.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, Pageslop and its operators are not liable for any indirect, incidental, or consequential damages arising from your use of the service.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions? Email <LegalLink href="mailto:dalton@citreum.com">dalton@citreum.com</LegalLink>.
        </p>
      </LegalSection>
    </LegalArticle>
  )
}
