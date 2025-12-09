'use client'

import PolicyLayout from '../policy-layout';

export default function DisclaimerPage() {
  return (
    <PolicyLayout title="Disclaimer">
        
        <section className="text-gray-700 mb-4">
        <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>
      
      <div className="space-y-6">
        <section className="bg-yellow-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Risk Disclosure</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Trading in securities market involves risk of loss and is subject to market volatility.</li>
            <li>Past performance is not indicative of future results.</li>
            <li>The kill switch tool is an aid and does not guarantee prevention of losses.</li>
            <li>Users should exercise their own judgment and trade responsibly.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">SEBI Registration</h2>
          <p>Please verify and confirm that your broker is SEBI registered before using this tool.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Compliance Requirements</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Maintain proper records of all transactions</li>
            <li>Follow prescribed risk management measures</li>
            <li>Adhere to trading limits set by exchanges</li>
            <li>Follow all applicable SEBI guidelines and regulations</li>
          </ul>
        </section>
      </div>
          </section>
        </PolicyLayout>
  );
}