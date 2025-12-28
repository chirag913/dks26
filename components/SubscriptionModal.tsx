'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';
import Script from 'next/script';
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
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const supabase = createClientComponentClient();


  /* -------------------- CHECK STATUS -------------------- */

  useEffect(() => {
    if (isOpen) checkSubscription();
  }, [isOpen]);

  const checkSubscription = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      const res = await fetch('/api/subscription/check-status', {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        setSubscription(json.subscription ?? null);
      } else {
        setSubscription(null);
      }
    } catch {
      setSubscription(null);
    }
  };

  /* -------------------- TRY TRIAL FIRST -------------------- */

  const tryStartTrial = async (): Promise<boolean> => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Not authenticated');

    const res = await fetch('/api/subscription/start-trial', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    });

    if (res.ok) return true;        // ✅ trial created
    if (res.status === 409) return false; // ❌ already used
    const j = await res.json().catch(() => null);
    throw new Error(j?.error ?? 'Failed to start trial');
  };

  /* -------------------- PAID FLOW -------------------- */

  const openPaidSubscription = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Not authenticated');

    const res = await fetch('/api/subscription/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.error ?? 'Failed to create subscription');
    }

    const dataRes = await res.json();

    const options = {
      key: dataRes.key_id,
      subscription_id: dataRes.subscriptionId,
      name: 'KillSwitch Pro',
      description: 'Premium Monthly Subscription',
      theme: { color: '#000000' },

      handler: async (response: any) => {
        const { data: verifySession } = await supabase.auth.getSession();
        if (!verifySession.session) throw new Error('Session expired');

        const verifyRes = await fetch('/api/subscription/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${verifySession.session.access_token}`,
          },
          body: JSON.stringify({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });

        if (!verifyRes.ok) throw new Error('Payment verification failed');

        await checkSubscription();
        onSuccess();
        onClose();
      },

      modal: {
        ondismiss: () => setLoading(false),
      },
    };

    if (!(window as any).Razorpay) throw new Error('Razorpay not loaded');
    new (window as any).Razorpay(options).open();
  };

  /* -------------------- MAIN HANDLER -------------------- */

  const handleSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      // 🔥 TRY TRIAL FIRST
      const trialStarted = await tryStartTrial();
      if (trialStarted) {
        await checkSubscription();
        onSuccess();
        onClose();
        return;
      }

      // 💳 FALLBACK TO PAID
      await openPaidSubscription();
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isSubscribed =
    subscription?.status === 'active' && !subscription?.is_trial;

  /* -------------------- UI -------------------- */

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
        <div className="bg-white p-6 rounded-lg w-96">
          <div className="flex justify-between mb-4">
<h2 className="text-xl font-bold text-black">Premium Subscription</h2>
            <button onClick={onClose}><X /></button>
          </div>

          {error && (
            <div className="mb-3 bg-red-50 text-red-700 p-2 rounded text-sm">
              {error}
            </div>
          )}

          {isSubscribed && (
            <div className="mb-3 bg-green-50 text-green-700 p-2 rounded flex gap-2">
              <CheckCircle size={16} />
              Active Subscription
            </div>
          )}

          <div className="mb-4 text-sm text-gray-600">
            • Max loss protection<br />
            • Order limit control<br />
            • Auto kill-switch<br />
            • Real-time alerts
          </div>

          {!isSubscribed && (
            <button
              onClick={handleSubscription}
              disabled={loading}
              className="w-full bg-black text-white py-3 rounded"
            >
              {loading ? 'Processing…' : 'Start Free Trial'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default SubscriptionModal;
