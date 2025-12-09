// app/terms/page.tsx
'use client'

import PolicyLayout from '../policy-layout';

export default function TermsPage() {
  return (
    <PolicyLayout title="Terms and Conditions">
      <section className="text-gray-700 mb-4">
        <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
        <p className="text-gray-700 mb-4">
          Welcome to KillSwitch Pro. By using our service, you agree to these terms. Please read them carefully.
        </p>
      </section>

      <section className="text-gray-700 mb-4">
        <h2 className="text-xl font-semibold mb-4">2. Use of Service</h2>
        <p className="text-gray-700 mb-4">
          KillSwitch Pro provides automated trading risk management tools. Users must be 18 years or older and comply with all applicable laws and regulations.
        </p>
      </section>

          <section className="text-gray-700 mb-4">
            <h2 className="text-xl font-semibold mb-4">3. Account Registration</h2>
            <p className="text-gray-700 mb-4">
              Users must provide accurate information when registering and keep their account credentials secure.
            </p>
          </section>

          <section className="text-gray-700 mb-4">
            <h2 className="text-xl font-semibold mb-4">4. Subscription and Payments</h2>
            <p className="text-gray-700 mb-4">
              Services are provided on a subscription basis. Payment terms and conditions apply as specified during purchase.
            </p>
          </section>

          <section className="text-gray-700 mb-4">
            <h2 className="text-xl font-semibold mb-4">5. Risk Disclaimer</h2>
            <p className="text-gray-700 mb-4">
              Trading involves significant risk. Our tools are aids but do not guarantee profit or prevent all losses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">6. Contact Information</h2>
            <p className="text-gray-700">
              For any questions about these terms, please contact us at support@killswitchpro.com
            </p>
          </section>
        
    </PolicyLayout>
  );
}