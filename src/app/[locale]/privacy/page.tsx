import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: "Privacy Policy",
    description:
      "Read AfroBirthday's privacy policy to understand what data we collect, how we use it, and how we protect your photos and personal information.",
    alternates: {
      canonical: `/${locale}/privacy`,
    },
    openGraph: {
      title: "Privacy Policy",
      description:
        "Read AfroBirthday's privacy policy to understand what data we collect, how we use it, and how we protect your photos and personal information.",
      url: `/${locale}/privacy`,
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      title: "Privacy Policy",
      description:
        "Read AfroBirthday's privacy policy to understand what data we collect, how we use it, and how we protect your photos and personal information.",
      images: ["/logo.png"],
    },
  };
}

export default function PrivacyPage() {
  return (
    <main className="pt-24 pb-20">
      <div className="section-container max-w-4xl">
        <h1 className="heading-1 text-center mb-8">Privacy Policy</h1>
        <p className="text-dark/60 text-center mb-12">Last updated: January 2024</p>

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
            <h2 className="heading-2 mb-4">6. Cookies</h2>
            <p className="text-dark/80">
              We use essential cookies for website functionality and analytics cookies
              (with your consent) to understand how visitors use our site. You can
              manage cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">7. Third-Party Services</h2>
            <p className="text-dark/80">
              We use trusted third-party services including a payment provider for payments and
              analytics tools. These services have their own privacy policies and
              handle data according to their terms.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">8. Contact Us</h2>
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
