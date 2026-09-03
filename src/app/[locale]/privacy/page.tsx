import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildAlternates } from "@/lib/seo";
import StructuredData from "@/components/StructuredData";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LegalMeta.privacy" });
  const title = t("title");
  const description = t("description");

  return {
    title,
    description,
    alternates: buildAlternates(locale, "/privacy"),
    openGraph: {
      title,
      description,
      url: `/${locale}/privacy`,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LegalMeta.privacy" });

  return (
    <main className="pt-24 pb-20">
      <StructuredData type="page" locale={locale} pageName={t("title")} path="/privacy" />
      <div className="section-container max-w-4xl">
        <h1 className="heading-1 text-center mb-8">Privacy Policy</h1>
        <p className="text-dark/60 text-center mb-12">Last updated: September 2026</p>

        <div className="prose prose-lg max-w-none space-y-8">
          <section>
            <h2 className="heading-2 mb-4">1. Information We Collect</h2>
            <p className="text-dark/80 mb-4">
              When you use AfroBirthday, we collect the following information:
            </p>
            <ul className="list-disc list-inside text-dark/80 space-y-2">
              <li>
                <strong>Contact Information:</strong> Email address for order delivery and communication
              </li>
              <li>
                <strong>Photos:</strong> Images you upload for video personalization
              </li>
              <li>
                <strong>Custom Messages:</strong> Text content you provide for your video
              </li>
              <li>
                <strong>Payment Information:</strong> Processed securely by our payment provider (we do not store card details)
              </li>
              <li>
                <strong>Usage Data:</strong> How you interact with our website for improvement purposes
              </li>
              <li>
                <strong>Session Recordings:</strong> A reconstruction of your visit — the pages you
                viewed, and where you clicked, scrolled and tapped — so we can find and fix parts of
                the ordering process that do not work. Everything you type is masked before it
                leaves your browser, and the payment step is excluded from recording entirely.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="heading-2 mb-4">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-dark/80">
              <li>To create and deliver your personalized birthday video</li>
              <li>To process payments and send order confirmations</li>
              <li>To communicate with you about your order</li>
              <li>To improve our services and user experience</li>
              <li>To send marketing communications (only with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="heading-2 mb-4">3. Photo Handling & Deletion</h2>
            <p className="text-dark/80 mb-4">We take your privacy seriously. Photos you upload are:</p>
            <ul className="list-disc pl-6 space-y-2 text-dark/80">
              <li>Encrypted during upload and storage</li>
              <li>Used only for creating your personalized video</li>
              <li>Automatically deleted from our servers within 30 days after video delivery</li>
              <li>Never shared with third parties for marketing purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="heading-2 mb-4">4. Data Security</h2>
            <p className="text-dark/80">
              We implement industry-standard security measures including SSL encryption,
              secure credit card payment processing, and regular security audits to
              protect your personal information.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">5. GDPR Compliance (EU Users)</h2>
            <p className="text-dark/80 mb-4">If you are in the European Union, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-dark/80">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
            </ul>
            <p className="text-dark/80 mt-4">To exercise these rights, contact us at support@afrobirthday.com</p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">6. Session Recordings</h2>
            <p className="text-dark/80 mb-4">
              To find out where the ordering process fails people, we record how visits unfold:
              which pages were opened, and where the mouse or finger went. These recordings are
              processed by PostHog on servers in the European Union.
            </p>
            <p className="text-dark/80 mb-4">
              What is never recorded:
            </p>
            <ul className="list-disc list-inside space-y-2 text-dark/80 mb-4">
              <li>Anything you type. Every input, including your e-mail address and your birthday message, is replaced before the recording leaves your browser.</li>
              <li>The payment step. Card details are entered inside Stripe&apos;s own secure frame, and the whole payment window is excluded from recording.</li>
              <li>The photo you upload.</li>
            </ul>
            <p className="text-dark/80">
              Recordings are kept for at most 30 days and then deleted. You can opt out at any
              time by enabling &ldquo;Do Not Track&rdquo; in your browser, or by writing to{" "}
              <a href="mailto:support@afrobirthday.com" className="text-primary underline">
                support@afrobirthday.com
              </a>
              , and we will delete any recording of your visits.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">7. Cookies</h2>
            <p className="text-dark/80">
              We use essential cookies for website functionality and analytics cookies
              (with your consent) to understand how visitors use our site. You can
              manage cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">8. Third-Party Services</h2>
            <p className="text-dark/80 mb-4">
              We use the following processors. Each has its own privacy policy and handles data
              according to its own terms.
            </p>
            <ul className="list-disc list-inside space-y-2 text-dark/80">
              <li>
                <strong>Stripe</strong> and <strong>PayPal</strong> — payment processing. Card
                details are entered directly into their systems and never reach our servers.
              </li>
              <li>
                <strong>PostHog</strong> (hosted in the European Union) — product analytics and
                session recordings, used to understand and fix how the site behaves.
              </li>
              <li>
                <strong>Google Analytics</strong> — aggregate audience measurement.
              </li>
              <li>
                <strong>Resend</strong> — sending order confirmations and other e-mails.
              </li>
              <li>
                <strong>Vercel</strong> and <strong>Supabase</strong> — hosting, and storage of
                your order and its photo.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="heading-2 mb-4">9. Contact Us</h2>
            <p className="text-dark/80">
              For any privacy-related questions or requests, please contact us at:{" "}
              <a href="mailto:support@afrobirthday.com" className="text-primary hover:underline">
                support@afrobirthday.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
