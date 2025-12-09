// app/contact/page.tsx
import Link from 'next/link'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-50 to-indigo-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                KillSwitch Pro
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/login"
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Login
              </Link>
              <Link 
                href="/register"
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="bg-white shadow-xl rounded-lg max-w-2xl mx-auto">
          <div className="p-8">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">
              Contact Support
            </h1>
            
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h2 className="text-xl font-semibold text-blue-800 mb-2">
                  Support Hours
                </h2>
                <p className="text-blue-700">
                  Monday - Friday: 10:00 AM to 6:00 PM IST
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Email Support
                  </h3>
                  <p className="text-gray-600 mb-2">
                    <strong>General Inquiries:</strong>
                    <a 
                      href="mailto:support@tradesafe.com" 
                      className="text-blue-600 hover:underline ml-2"
                    >
                      support@killswitchpro.com
                    </a>
                  </p>
                  <p className="text-gray-600">
                    <strong>Technical Support:</strong>
                    <a 
                      href="mailto:tech@killswitchpro.com" 
                      className="text-blue-600 hover:underline ml-2"
                    >
                      tech@killswitchpro.com
                    </a>
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Whatsapp Support
                  </h3>
                  <p className="text-gray-600">
                    <strong>Helpline:</strong>
                    <span className="ml-2">+91 80 4567 8901</span>
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    (Available during support hours)
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Frequently Asked Questions
                </h3>
                <p className="text-gray-600 mb-4">
                  Before reaching out, please check our 
                  <Link 
                    href="/#faq" 
                    className="text-blue-600 hover:underline ml-1"
                  >
                    Frequently Asked Questions
                  </Link>
                  . Your answer might be there!
                </p>
              </div>

              <div className="text-center">
              <Link
  href="/support-ticket"
  className="w-full md:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
>
  Open a Support Ticket
</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}