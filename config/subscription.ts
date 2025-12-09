// config/subscription.ts
export const SUBSCRIPTION_CONFIG = {
  BASE_AMOUNT: 999,      // base price in rupees (₹999)
  GST_RATE: 0.18,        // 18% GST
  CURRENCY: 'INR',
  PLAN_NAME: 'KillSwitch Pro - Monthly'
}

/**
 * calculateAmounts
 * Returns amounts in rupees (floating numbers for display) and paise when needed.
 */
export function calculateAmounts() {
  const baseAmount = Number(SUBSCRIPTION_CONFIG.BASE_AMOUNT)
  const gstAmount = Number((baseAmount * SUBSCRIPTION_CONFIG.GST_RATE))
  const totalAmount = Number((baseAmount + gstAmount))

  // also provide paise-safe values if needed
  const baseInPaise = Math.round(baseAmount * 100)
  const gstInPaise = Math.round(gstAmount * 100)
  const totalInPaise = baseInPaise + gstInPaise

  return {
    baseAmount,
    gstAmount,
    totalAmount,
    baseInPaise,
    gstInPaise,
    totalInPaise
  }
}

export default SUBSCRIPTION_CONFIG
