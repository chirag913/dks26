import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';

const ApiSetupGuide: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const steps = [
    { title: "Visit Dhan Website", instruction: "Go to web.dhan.co and log into your account" },
    { title: "Access Profile Settings", instruction: "Click on your profile icon and select 'Manage Account'" },
    { title: "Navigate to API Section", instruction: "Click on 'DhanHQ Trading APIs'" },
    { title: "Generate New Token", instruction: "Click on '+ New Token', set validity to 30 days, and generate the token" }
  ];

  return (
    <div className="bg-gray-100 rounded-lg p-4">
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-700" />
          <span className="font-semibold text-gray-900">API Setup Guide</span>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="bg-white border rounded-lg p-3">
              <div className="flex items-start mb-2">
                <div className="flex-shrink-0 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center mr-3">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-black mb-1">{step.title}</h3>
                  <p className="text-xs text-gray-600">{step.instruction}</p>
                </div>
              </div>
            </div>
          ))}
          
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-800 font-medium">
              Important: Copy your token immediately and store it securely. 
              It will only be shown once and cannot be retrieved later.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiSetupGuide;