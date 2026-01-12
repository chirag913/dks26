/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { ShieldCheck, AlertTriangle } from 'lucide-react'

/* ================= TYPES ================= */

type TradingConfig = {
  max_loss: string
  max_orders: string
  daily_lock_date?: string | null
}

type PnlPoint = {
  time: string
  pnl: number
}

/* ================= COMPONENT ================= */

export default function Dashboard() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  const [config, setConfig] = useState<TradingConfig>({
    max_loss: '-5000',
    max_orders: '10'
  })

  const [currentPnL] = useState(0)
  const [orderCount] = useState(0)
  const [pnlHistory] = useState<PnlPoint[]>([])
  const [killTriggeredToday] = useState(false)

  const todayISO = new Date().toLocaleDateString('en-CA')
  const isLockedToday =
    config.daily_lock_date?.slice(0, 10) === todayISO

  /* ================= LOAD USER + CONFIG ================= */

  const loadUserAndConfig = useCallback(async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('trading_configs')
      .select('max_loss, max_orders, daily_lock_date')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setConfig({
        max_loss: String(data.max_loss),
        max_orders: String(data.max_orders),
        daily_lock_date: data.daily_lock_date
      })
    }
  }, [])

  useEffect(() => {
    loadUserAndConfig()
  }, [])

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Risk Control Center
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              UI-based intraday protection
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <span className="text-sm font-semibold text-emerald-800">
              Monitoring
            </span>
          </div>
        </div>

        {/* ALERT */}
        {killTriggeredToday && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">
              Kill switch triggered. Trading disabled for today.
            </span>
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Stat
            label="Current P&L"
            value={`₹${currentPnL.toFixed(2)}`}
            accent={currentPnL < 0 ? 'red' : 'green'}
          />
          <Stat label="Orders Executed" value={orderCount} />
          <Stat
            label="Kill Switch"
            value={killTriggeredToday ? 'Triggered' : 'Monitoring'}
            accent={killTriggeredToday ? 'red' : 'green'}
          />
        </div>

        {/* CHART */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            Intraday P&L
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={pnlHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis tick={{ fill: '#475569', fontSize: 12 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
              <Tooltip />
              <ReferenceLine
                y={Number(config.max_loss)}
                stroke="#EF4444"
                strokeDasharray="4 4"
              />
              <Line dataKey="pnl" stroke="#0F172A" strokeWidth={2} />
              <Area dataKey="pnl" fill="#0F172A" fillOpacity={0.08} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* LIMITS */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            Daily Risk Limits
          </h3>

          <Input label="Max Loss (₹)" value={config.max_loss} disabled />
          <Input label="Max Orders" value={config.max_orders} disabled />

          <button
            disabled
            className="w-full mt-4 py-3 rounded-xl bg-slate-200 text-slate-600 font-semibold cursor-not-allowed"
          >
            {isLockedToday ? 'Locked for Today' : 'Locked'}
          </button>
        </Card>
      </div>
    </div>
  )
}

/* ================= UI HELPERS ================= */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  accent
}: {
  label: string
  value: React.ReactNode
  accent?: 'red' | 'green'
}) {
  const color =
    accent === 'red'
      ? 'text-red-600'
      : accent === 'green'
      ? 'text-emerald-600'
      : 'text-slate-900'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>
        {value}
      </p>
    </div>
  )
}

function Input({
  label,
  value,
  disabled
}: {
  label: string
  value: string
  disabled?: boolean
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </label>
      <input
        value={value}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700"
      />
    </div>
  )
}
