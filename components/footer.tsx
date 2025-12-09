// components/footer.tsx
'use client'

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center">
          {/* Logo */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black">KillSwitch Pro</h2>
          </div>

          {/* SEBI Disclaimer */}
          <div className="mb-8 max-w-3xl text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-center mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                <span className="font-semibold text-yellow-600">Risk Disclosure</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Trading in securities market is subject to market risks. Please read all scheme related documents carefully before investing. Past performance is not indicative of future returns.
              </p>
              <p className="text-sm text-gray-600">
                KillSwitch Pro is a third-party tool and does not guarantee prevention of losses. Users should exercise their own judgment and trade responsibly.
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mb-6">
            <ul className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-8 text-center">
              <li>
                <Link 
                  href="/terms" 
                  className="text-gray-600 hover:text-black transition-colors text-sm"
                >
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link 
                  href="/privacy" 
                  className="text-gray-600 hover:text-black transition-colors text-sm"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  href="/refund" 
                  className="text-gray-600 hover:text-black transition-colors text-sm"
                >
                  Cancellation & Refund Policy
                </Link>
              </li>
              <li>
                <Link 
                  href="/disclaimer" 
                  className="text-gray-600 hover:text-black transition-colors text-sm"
                >
                  Risk Disclosure
                </Link>
              </li>
              <li>
                <Link 
                  href="/grievance" 
                  className="text-gray-600 hover:text-black transition-colors text-sm"
                >
                  Grievance Redressal
                </Link>
              </li>
            </ul>
          </nav>

          {/* Compliance Information */}
          <div className="mb-6 text-center">
            <p className="text-xs text-gray-500 mb-2">
              KillSwitch Pro maintains records in accordance with SEBI guidelines. For any queries or grievances, please contact our compliance officer.
            </p>
            <p className="text-xs text-gray-500">
              Email: compliance@killswitchpro.com 
            </p>
          </div>

          {/* Copyright */}
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} KillSwitch Pro. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;