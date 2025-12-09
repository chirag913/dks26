'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';
import Script from 'next/script';
import { calculateAmounts } from '@/config/subscription';
import type { Subscription } from '@/types/subscription';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const supabase = createClientComponentClient();

  const { baseAmount, gstAmount, totalAmount } = calculateAmounts();

  // Fetch subscription status
  useEffect(() => {
    if (isOpen) {
      checkSubscription();
    }
  }, [isOpen]);

  const checkSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current auth session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        console.log('No active session, skipping subscription check');
        setSubscription(null);
        return;
      }
      
      // Attempt to fetch subscription data with auth token
      const response = await fetch('/api/subscription/check-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.warn(`Server returned ${response.status} when checking subscription`);
        // Don't set error in UI for subscription check failure
        setSubscription(null);
        return;
      }
      
      try {
        const data = await response.json();
        setSubscription(data.subscription || null);
      } catch (parseError) {
        console.error('Error parsing subscription response:', parseError);
        setSubscription(null);
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current auth session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`);
      }
      
      if (!sessionData.session) {
        throw new Error("You need to be signed in to subscribe. Please log in and try again.");
      }

      // Create paid subscription directly
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        credentials: 'include',
        body: JSON.stringify({}) // Empty body but required for POST request
      });

      // Handle errors with better context
      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If we can't parse response as JSON, use status code
          if (response.status === 401) {
            errorMessage = "Authentication failed. Please sign out and sign in again.";
          } else if (response.status === 403) {
            errorMessage = "You don't have permission to subscribe.";
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(typeof data.error === 'string' 
          ? data.error 
          : 'An error occurred processing your subscription');
      }

      if (!data.key_id || !data.subscriptionId) {
        throw new Error('Invalid response from server');
      }

      // Initialize Razorpay
      const options = {
        key: data.key_id,
        subscription_id: data.subscriptionId,
        name: 'KillSwitch Pro',
        description: 'Premium Monthly Subscription',
        theme: {
          color: '#000000',
        },
        handler: async function (response: any) {
          try {
            // Get fresh session for verification
            const { data: verifySession } = await supabase.auth.getSession();
            if (!verifySession.session) {
              throw new Error('Session expired during payment. Please try again.');
            }
            
            const verifyResponse = await fetch('/api/subscription/verify', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${verifySession.session.access_token}`
              },
              credentials: 'include',
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyResponse.ok) {
              throw new Error(`Verification failed: ${verifyResponse.status}`);
            }

            const verifyData = await verifyResponse.json();
            
            if (verifyData.error) {
              throw new Error(typeof verifyData.error === 'string' 
                ? verifyData.error 
                : 'Payment verification failed');
            }
            
            await checkSubscription();
            onSuccess();
            onClose();
          } catch (error) {
            console.error('Verification error:', error);
            setError(error instanceof Error ? error.message : 'Payment verification failed. Please contact support.');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        },
        prefill: {
          name: 'User Name',
          email: 'user@example.com',
        }
      };

      // Check if Razorpay is loaded before creating an instance
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      } else {
        throw new Error('Razorpay checkout is not loaded properly. Please refresh and try again.');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      setError(error instanceof Error ? error.message : 'Failed to initiate subscription');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isSubscribed = subscription?.status === 'active' && !subscription?.is_trial;
  const formattedExpiryDate = subscription?.end_date 
    ? new Date(subscription.end_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : null;

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
        <div className="bg-white p-6 rounded-lg w-96" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-black">Premium Subscription</h2>
            <button 
  onClick={onClose} 
  className="p-1 text-black hover:text-gray-700 transition"
>
  <X className="h-6 w-6" />
</button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {isSubscribed && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <div>
                <p className="font-semibold">Subscribed</p>
                {formattedExpiryDate && (
                  <p className="text-sm">Expires on: {formattedExpiryDate}</p>
                )}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-black">Premium Features:</h3>
            <ul className="space-y-2 text-gray-600">
              <li>• Max Loss, Max orders Alert</li>
              <li>• Live Profit/Loss Monitor</li>
              <li>• Easy setup</li>
              <li>• Real-time notifications</li>
            </ul>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2 text-black">Subscription Details:</h4>
            <div className="space-y-2 text-sm">
              <p className="flex justify-between">
                <span className="text-gray-600 text-black">Base Amount:</span>
                <span className="font-medium text-black">₹{baseAmount.toFixed(2)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-gray-600 text-black">GST (18%):</span>
                <span className="font-medium text-black">₹{gstAmount.toFixed(2)}</span>
              </p>
              <div className="border-t pt-2 mt-2">
                <p className="flex justify-between font-semibold text-black">
                  <span>Total Amount:</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Billed monthly. Cancel anytime.
              </p>
            </div>
          </div>

          {!isSubscribed && (
            <button
              onClick={handleSubscription}
              disabled={loading}
              className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </button>
          )}
          
          <p className="text-xs text-gray-500 mt-4 text-center">
            By subscribing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </>
  );
};

export default SubscriptionModal;