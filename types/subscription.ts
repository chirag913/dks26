export interface Subscription {
  id: string;
  user_id: string;
  status: 'trial' | 'active' | 'cancelled' | 'expired';
  plan_type: 'premium';
  start_date: string;
  end_date: string;
  razorpay_subscription_id?: string;
  razorpay_payment_id?: string;
  amount?: number;
  gst_amount?: number;
  total_amount?: number;
  currency: string;
  is_trial: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentVerificationData {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface SubscriptionResponse {
  subscription?: Subscription;
  error?: string;
}