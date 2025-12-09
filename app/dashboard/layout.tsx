'use client'

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(true); // Start with mobile view by default

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 1024); // Using lg breakpoint
    };

    // Initial check
    checkIfMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isMobile={isMobile} />
      
      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm z-30 flex items-center justify-center">
          <h2 className="text-xl font-bold text-black">KillSwitch Pro</h2>
        </div>
      )}

      <main 
        className={`
          transition-all duration-300 ease-in-out
          ${isMobile ? 'w-full pt-16' : 'lg:ml-64'}
        `}
      >
        {children}
      </main>
    </div>
  );
}