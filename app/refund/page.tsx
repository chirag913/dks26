// app/refund/page.tsx
'use client'

import PolicyLayout from '../policy-layout';

export default function RefundPage() {
  return (
    <PolicyLayout title="Cancellation & Refund Policy">
      <section className="text-gray-700 mb-4">
        <h2 className="text-xl font-semibold mb-4">1. Subscription Cancellation</h2>
        <p className="text-gray-700 mb-4">
          You can cancel your subscription at any time through your account settings. Cancellation will take effect at the end of your current billing period.
        </p>
      </section>

      <section className="text-gray-700 mb-4">
        <h2 className="text-xl font-semibold mb-4">2. Refund Policy</h2>
        <p className="text-gray-700 mb-4">
          We offer a 7-day refund period for new subscriptions. Refund requests after this period will be evaluated on a case-by-case basis.
        </p>
      </section>

          <section className="text-gray-700 mb-4">
            <h2 className="text-xl font-semibold mb-4">3. How to Request a Refund</h2>
            <p className="text-gray-700 mb-4">
              To request a refund, please contact our support team with your account details and reason for the refund.
            </p>
          </section>

          <section className="text-gray-700 mb-4">
            <h2 className="text-xl font-semibold mb-4">4. Processing of Refunds</h2>
            <p className="text-gray-700 mb-4">
              Approved refunds will be processed within 5-7 business days and will be issued to the original payment method.
            </p>
          </section>

          <section className="text-gray-700 mb-4">
            <h2 className="text-xl font-semibold mb-4">5. Non-refundable Items</h2>
            <p className="text-gray-700 mb-4">
              Certain promotional offers and special discounts may be non-refundable. This will be clearly stated at the time of purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">6. Contact Information</h2>
            <p className="text-gray-700">
              For refund requests or questions about our policy, please contact support@killswitchpro.com
            </p>
          </section>
          </PolicyLayout>
  );
}