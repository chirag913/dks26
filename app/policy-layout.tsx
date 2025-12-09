// app/policy-layout.tsx
'use client'

import Header from "@/components/header";


interface PolicyLayoutProps {
  children: React.ReactNode;
  title: string;
}

const PolicyLayout = ({ children, title }: PolicyLayoutProps) => {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 max-w-3xl py-8">
          <h1 className="text-3xl font-bold mb-8 text-black">{title}</h1>
          <div className="bg-white p-6 rounded-lg shadow">
            {children}
          </div>
        </div>
      </div>
      <Header />
    </>
  );
};

export default PolicyLayout;