// app/page.tsx
'use client'

import Link from 'next/link'
import {
  ShieldCheck,
  Zap,
  BarChart2,
  Clock,
  CheckCircle,
  ChevronRight
} from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-800">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md">
                <span className="text-white font-bold">DK</span>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">KillSwitch Pro</h1>
                <p className="text-xs text-gray-500 -mt-0.5">Protect your trading capital</p>
              </div>
            </div>

            <nav className="flex items-center gap-3">
              <Link href="/login" className="px-4 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100">
                Login
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
              >
                Register
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-14">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Hero */}
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full w-max">
              <ShieldCheck className="w-4 h-4" /> Enterprise-grade protection
            </p>

            <h2 className="text-4xl lg:text-5xl font-extrabold leading-tight text-gray-900">
              Protect your trading capital — <span className="text-blue-600">automatically</span>
            </h2>

            <p className="text-lg text-gray-600 max-w-xl">
              KillSwitch Pro monitors P&L and order flow in real-time and executes fast, safe shutdown actions when limits are breached — so you can trade with confidence.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-blue-600 text-white text-base font-semibold shadow hover:bg-blue-700 transition"
              >
                Get Started — ₹999 / month
                <ChevronRight className="w-4 h-4 opacity-90" />
              </Link>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                View demo dashboard
              </Link>
            </div>

            <div className="flex gap-6 mt-4">
              <div className="flex items-start gap-3">
                <Zap className="w-6 h-6 text-indigo-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900">Instant actions</div>
                  <div className="text-sm text-gray-500">Cancel orders & close positions fast.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <BarChart2 className="w-6 h-6 text-indigo-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900">Clear insights</div>
                  <div className="text-sm text-gray-500">Live P&L, peak, drawdown and audit logs.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing / value panel */}
          <aside className="order-first lg:order-last">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly plan</p>
                  <h3 className="mt-1 text-2xl font-extrabold text-gray-900">Pro</h3>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-gray-900">₹999</div>
                  <div className="text-sm text-gray-500">per month + GST</div>
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <span className="text-sm text-gray-700">Real-time trade monitoring</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <span className="text-sm text-gray-700">Customizable daily max loss</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <span className="text-sm text-gray-700">Automatic order cancellation</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <span className="text-sm text-gray-700">Audit logs & notifications</span>
                </li>
              </ul>

              <div className="mt-6">
                <Link
                  href="/register"
                  className="w-full inline-flex items-center justify-center px-4 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                >
                  Start 7-day trial
                </Link>
              </div>

              <div className="mt-4 text-xs text-gray-400">
                Cancel anytime. Trusted by active traders.
              </div>
            </div>

            <div className="mt-6 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>24/7 technical support</span>
              </div>
            </div>
          </aside>
        </section>

        {/* Features */}
        <section className="mt-20">
          <h3 className="text-2xl font-extrabold text-gray-900 text-center">Key Features</h3>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
                <h4 className="font-semibold">Real-time Monitoring</h4>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Track P&L and order counts live with automated threshold checks and audit logs for every action.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-indigo-600" />
                <h4 className="font-semibold">Instant Kill Switch</h4>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Automatically cancel pending orders and flatten positions when your limits are reached.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <BarChart2 className="w-6 h-6 text-indigo-600" />
                <h4 className="font-semibold">Session Insights</h4>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Peak, average and drawdown charts give you a clear view of session performance.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing details / FAQs */}
        <section className="mt-20 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <h3 className="text-2xl font-extrabold text-gray-900">Simple, Transparent Pricing</h3>
            <p className="mt-3 text-gray-600">
              One straightforward plan — everything you need to protect your trading capital.
            </p>

            <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-3xl font-extrabold">₹999</div>
                  <div className="text-sm text-gray-500">per month + GST</div>
                </div>
                <div>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Subscribe
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
                  <span>All features included — no hidden fees</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
                  <span>Works with Dhan API</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
                  <span>Priority support for subscribers</span>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-extrabold text-gray-900">Frequently Asked Questions</h3>

            <div className="mt-6 space-y-4">
              <details className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
                <summary className="cursor-pointer list-none text-gray-900 font-medium">How does the Kill Switch work?</summary>
                <p className="mt-3 text-sm text-gray-600">
                  KillSwitch watches your configured loss and order thresholds in real-time. When a limit is hit, it cancels open orders and flattens positions (best-effort) — then logs everything for audit.
                </p>
              </details>

              <details className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
                <summary className="cursor-pointer list-none text-gray-900 font-medium">Where do I get my Dhan API key?</summary>
                <p className="mt-3 text-sm text-gray-600">
                  Log into your Dhan account at <a href="https://web.dhan.co" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">web.dhan.co</a>, go to Profile → API, and generate a token. Paste it into the dashboard's API settings.
                </p>
              </details>

              <details className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
                <summary className="cursor-pointer list-none text-gray-900 font-medium">Does this place trades for me?</summary>
                <p className="mt-3 text-sm text-gray-600">
                  No — KillSwitch only cancels orders and closes positions to stop losses. It does not open new trades on your behalf.
                </p>
              </details>
            </div>

            <div className="mt-6 text-sm text-gray-600">
              <p>Need more help? <Link href="/contact" className="text-blue-600 hover:underline">Contact support</Link>.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">© {new Date().getFullYear()} KillSwitch Pro — Built for traders.</div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/terms" className="text-gray-600 hover:text-gray-900">Terms</Link>
            <Link href="/privacy" className="text-gray-600 hover:text-gray-900">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
