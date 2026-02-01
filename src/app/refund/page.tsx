import Link from "next/link";

export default function RefundPage() {
  return (
    <main className="pt-24 pb-20">
      <div className="section-container max-w-4xl">
        <h1 className="heading-1 text-center mb-8">Refund Policy</h1>
        <p className="text-dark/60 text-center mb-12">Last updated: January 2024</p>

        <div className="prose prose-lg max-w-none space-y-8">
          <div className="bg-success/10 border border-success/20 p-6 rounded-xl mb-8">
            <h2 className="text-xl font-semibold text-success mb-2">
              💯 100% Money-Back Guarantee
            </h2>
            <p className="text-dark/80 mb-0">
              We stand behind our product. If you&apos;re not completely satisfied with your 
              birthday video, we&apos;ll give you a full refund within 7 days of delivery.
            </p>
          </div>

          <section>
            <h2 className="heading-2 mb-4">Our Guarantee</h2>
            <p className="text-dark/80">
              At AfroBirthday, customer satisfaction is our top priority. We want you to 
              love your personalized birthday video. If for any reason you&apos;re not happy 
              with the result, we offer a straightforward refund process.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">Refund Eligibility</h2>
            <p className="text-dark/80 mb-4">You are eligible for a full refund if:</p>
            <ul className="list-disc pl-6 space-y-2 text-dark/80">
              <li>You request a refund within 7 days of receiving your video</li>
              <li>The video quality does not meet reasonable expectations</li>
              <li>There are errors in the personalization (wrong name, message, etc.)</li>
              <li>The video was not delivered within the promised timeframe</li>
              <li>You are simply not satisfied with the final product</li>
            </ul>
          </section>

          <section>
            <h2 className="heading-2 mb-4">How to Request a Refund</h2>
            <p className="text-dark/80 mb-4">
              Requesting a refund is simple. Just follow these steps:
            </p>
            <ol className="list-decimal pl-6 space-y-3 text-dark/80">
              <li>
                <strong>Email us</strong> at{" "}
                <a href="mailto:hello@afrobirthday.com" className="text-primary hover:underline">
                  hello@afrobirthday.com
                </a>
              </li>
              <li>
                <strong>Include your Order ID</strong> (found in your confirmation email)
              </li>
              <li>
                <strong>Briefly explain</strong> why you&apos;re requesting a refund (optional but helpful)
              </li>
              <li>
                <strong>Receive your refund</strong> within 5-7 business days
              </li>
            </ol>
          </section>

          <section>
            <h2 className="heading-2 mb-4">Refund Processing</h2>
            <p className="text-dark/80">
              Refunds are processed back to your original payment method. Depending on 
              your bank or card issuer, it may take 5-7 business days for the refund 
              to appear in your account. You will receive an email confirmation once 
              the refund has been processed.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">Free Remake Option</h2>
            <p className="text-dark/80">
              Before requesting a refund, consider our free remake option! If there&apos;s 
              something specific you&apos;d like changed about your video, we&apos;ll remake it 
              at no extra cost. Just email us with your feedback, and we&apos;ll create a 
              new video within 24 hours.
            </p>
          </section>

          <section>
            <h2 className="heading-2 mb-4">Exceptions</h2>
            <p className="text-dark/80 mb-4">
              While we strive to accommodate all refund requests, the following situations 
              may not be eligible:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-dark/80">
              <li>Refund requested more than 7 days after video delivery</li>
              <li>Video has already been shared publicly on social media</li>
              <li>Multiple refund requests from the same customer</li>
            </ul>
          </section>

          <section>
            <h2 className="heading-2 mb-4">Contact Us</h2>
            <p className="text-dark/80">
              Have questions about our refund policy? We&apos;re here to help!{" "}
              <a href="mailto:hello@afrobirthday.com" className="text-primary hover:underline">
                Email us
              </a>{" "}
              and we&apos;ll respond within 24 hours.
            </p>
          </section>

          <div className="text-center pt-8">
            <Link href="/#order" className="btn-primary inline-block">
              Create Your Birthday Video
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
