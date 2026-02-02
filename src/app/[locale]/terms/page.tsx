import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: "Terms of Service",
    description:
      "Read AfroBirthday terms of service including ordering, payment, delivery timelines, refunds, and content guidelines.",
    alternates: {
      canonical: `/${locale}/terms`,
    },
    openGraph: {
      title: "Terms of Service",
      description:
        "Read AfroBirthday terms of service including ordering, payment, delivery timelines, refunds, and content guidelines.",
      url: `/${locale}/terms`,
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      title: "Terms of Service",
      description:
        "Read AfroBirthday terms of service including ordering, payment, delivery timelines, refunds, and content guidelines.",
      images: ["/logo.png"],
    },
  };
}

export default function TermsPage() {
  return (
    <main className="pt-24 pb-20">
      <div className="section-container max-w-4xl">
        <h1 className="heading-1 text-center mb-8">Terms of Service</h1>
        <p className="text-dark/60 text-center mb-12">Last updated: January 2024</p>

        <div className="prose prose-lg max-w-none space-y-8">
          <section>
            <h2 className="heading-2 mb-4">1. Acceptance of Terms</h2>
            <p className="text-dark/80">
              By accessing and using AfroBirthday (&quot;the Service&quot;), you agree to be bound
              by these Terms of Service. If you do not agree to these terms, please do not
              use our Service.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">2. Description of Service</h2>
            <p className="text-dark/80">
              AfroBirthday provides personalized birthday video messages created by African
              dancers. Videos are delivered digitally within 24-48 hours (or 12-24 hours
              for Express orders) of payment confirmation.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">3. Ordering Process</h2>
            <p className="text-dark/80 mb-4">When placing an order, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2 text-dark/80">
              <li>Provide accurate and complete information</li>
              <li>Upload appropriate photos (no offensive or inappropriate content)</li>
              <li>Provide messages that are respectful and appropriate</li>
              <li>Pay the full amount at time of order</li>
            </ul>
          </section>

          <section>
            <h2 className="heading-2 mb-4">4. Content Guidelines</h2>
            <p className="text-dark/80 mb-4">We reserve the right to refuse orders that contain:</p>
            <ul className="list-disc pl-6 space-y-2 text-dark/80">
              <li>Offensive, discriminatory, or hateful content</li>
              <li>Inappropriate or explicit material</li>
              <li>Content that infringes on third-party rights</li>
              <li>Content promoting illegal activities</li>
            </ul>
          </section>

          <section>
            <h2 className="heading-2 mb-4">5. Intellectual Property</h2>
            <p className="text-dark/80">
              Upon delivery, you receive a personal, non-exclusive license to use your
              video for personal purposes. AfroBirthday retains the right to use videos
              (with identifying information removed) for promotional purposes unless you
              explicitly opt out.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">6. Payment Terms</h2>
            <p className="text-dark/80">
              All payments are processed securely by credit card. Prices are displayed in
              Euros (€) and include applicable taxes where required. Refunds are processed
              according to our Refund Policy.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">7. Delivery</h2>
            <p className="text-dark/80">
              Videos are delivered via email to the address provided during checkout.
              Standard delivery is 24-48 hours; Express delivery is 12-24 hours. While
              we strive to meet these timelines, occasional delays may occur due to high
              demand or unforeseen circumstances.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">8. Limitation of Liability</h2>
            <p className="text-dark/80">
              AfroBirthday provides videos &quot;as is&quot; and makes no warranties regarding
              specific outcomes. Our liability is limited to the amount paid for the
              service. We are not liable for indirect, incidental, or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">9. Dispute Resolution</h2>
            <p className="text-dark/80">
              Any disputes shall be resolved through good-faith negotiation. If resolution
              cannot be reached, disputes will be subject to the laws and courts of the
              Netherlands.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">10. Changes to Terms</h2>
            <p className="text-dark/80">
              We may update these terms from time to time. Continued use of the Service
              after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">11. Contact</h2>
            <p className="text-dark/80">
              For questions about these terms, contact us at:{" "}
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
