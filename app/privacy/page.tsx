// app/privacy/page.tsx
'use client'

import PolicyLayout from '../policy-layout';

export default function PrivacyPage() {
  return (
    <PolicyLayout title="Privacy Policy">
      <section className="text-black mb-8">
        <p className="mb-4">
          Last updated: {new Date().toLocaleDateString()}
        </p>
        <p className="mb-4">
          KillSwitch Pro ("we," "our," or "us") is committed to protecting your privacy and ensuring the security of your personal and financial information. This privacy policy explains how we collect, use, disclose, and safeguard your information in compliance with SEBI guidelines and applicable laws.
        </p>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>
        <div className="ml-4">
          <h3 className="font-semibold mb-2">1.1 Personal Information</h3>
          <ul className="list-disc ml-4 mb-4">
            <li>Name, and contact details</li>
            <li>Email address and phone number</li>  
            <li>Payment information</li>
            <li>Trading account details</li>            
          </ul>

          <h3 className="font-semibold mb-2">1.2 Trading Information</h3>
          <ul className="list-disc ml-4 mb-4">
            <li>Trading patterns and history</li>
            <li>Account balances and positions</li>
            <li>Trading preferences and settings</li>
            <li>Risk management parameters</li>
          </ul>

          <h3 className="font-semibold mb-2">1.3 Technical Information</h3>
          <ul className="list-disc ml-4 mb-4">
            <li>Device information and IP addresses</li>
            <li>Login timestamps and activity logs</li>
            <li>Browser type and operating system</li>
            <li>Usage patterns and preferences</li>
          </ul>
        </div>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">2. How We Use Your Information</h2>
        <ul className="list-disc ml-4 mb-4">
          <li>To provide and maintain our trading automation services</li>
          <li>To comply with SEBI regulations and other legal requirements</li>
          <li>To verify your identity and prevent fraud</li>
          <li>To process your transactions and maintain account records</li>
          <li>To communicate important updates and service information</li>
          <li>To improve our services and user experience</li>
          <li>To provide customer support and resolve disputes</li>
        </ul>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">3. Data Security</h2>
        <p className="mb-4">
          We implement industry-standard security measures to protect your information:
        </p>
        <ul className="list-disc ml-4 mb-4">
          <li>End-to-end encryption for data transmission</li>
          <li>Secure data storage with regular backups</li>
          <li>Access controls and authentication protocols</li>
          <li>Regular security audits and assessments</li>
          <li>Employee training on data protection</li>
        </ul>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">4. Information Sharing and Disclosure</h2>
        <p className="mb-4">We may share your information with:</p>
        <ul className="list-disc ml-4 mb-4">
          <li>Stock exchanges and regulatory authorities as required by law</li>
          <li>Banking partners for processing transactions</li>
          <li>Service providers who assist in our operations</li>
          <li>Legal and professional advisors</li>
        </ul>
        <p className="mb-4">
          We do not sell, rent, or trade your personal information to third parties for marketing purposes.
        </p>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">5. Retention Period</h2>
        <p className="mb-4">
          We retain your information for as long as required by SEBI regulations and applicable laws, typically for a minimum of 5 years after the closure of your account or completion of any investigation, whichever is later.
        </p>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">6. Your Rights</h2>
        <p className="mb-4">You have the right to:</p>
        <ul className="list-disc ml-4 mb-4">
          <li>Access your personal information</li>
          <li>Correct inaccurate or incomplete information</li>
          <li>Request deletion of your information (subject to regulatory requirements)</li>
          <li>Opt-out of promotional communications</li>
          <li>Receive your data in a structured format</li>
        </ul>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">7. Cookies and Tracking</h2>
        <p className="mb-4">
          We use cookies and similar technologies to enhance your experience and analyze usage patterns. You can control cookie settings through your browser preferences.
        </p>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">8. Changes to Privacy Policy</h2>
        <p className="mb-4">
          We may update this privacy policy periodically. Significant changes will be notified through email or our platform. Continued use of our services after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">9. Contact Information</h2>
        <p className="mb-4">For privacy-related inquiries or concerns, contact our Data Protection Officer:</p>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p>Email: support@killswitchpro.com</p>
          
        </div>
      </section>

      <section className="text-black mb-8">
        <h2 className="text-xl font-semibold mb-4">10. Regulatory Compliance</h2>
        <p className="mb-4">
          This privacy policy is in compliance with SEBI guidelines, Information Technology Act, 2000, and other applicable laws governing the protection of personal and financial information in India.
        </p>
      </section>
    </PolicyLayout>
  );
}