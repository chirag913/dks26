/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
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

/* ================= HELPERS ================= */

const todayISO = () => new Date().toLocaleDateString('en-CA')

const shouldUnlock = (lock?: string | null) =>
  !lock || lock.slice(0, 10) !== todayISO()

/* ================= COMPONENT ================= */

export default function Dashboard() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  const killInProgressRef = useRef(false)

  const [config, setConfig] = useState<TradingConfig>({
    max_loss: '-5000',
    max_orders: '10',
    daily_lock_date: null
  })

  const [currentPnL, setCurrentPnL] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [pnlHistory, setPnlHistory] = useState<PnlPoint[]>([])
  const [killTriggeredToday, setKillTriggeredToday] = useState(false)
  const [saving, setSaving] = useState(false)

  const lockedToday =
    config.daily_lock_date?.slice(0, 10) === todayISO()

  /* ================= LOAD CONFIG ================= */

  const loadConfig = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('trading_configs')
      .select('max_loss, max_orders, daily_lock_date')
      .eq('user_id', user.id)
      .single()

    if (!data) return

    const unlock = shouldUnlock(data.daily_lock_date)

    setConfig({
      max_loss: String(data.max_loss),
      max_orders: String(data.max_orders),
      daily_lock_date: unlock ? null : data.daily_lock_date
    })

    if (unlock && data.daily_lock_date) {
      await supabase
        .from('trading_configs')
        .update({ daily_lock_date: null })
        .eq('user_id', user.id)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [])

  /* ================= LIVE MONITOR ================= */

  const fetchLiveStats = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const res = await fetch('/api/dhan/summary', {
        headers: { 'x-user-id': user.id }
      })

      if (!res.ok) return

      const data = await res.json()

      // 🛑 Backend kill already active
      if (data.kill_switch) {
        setKillTriggeredToday(true)
        killInProgressRef.current = true
        return
      }

      const pnl = Number(data.pnl ?? 0)
      const orders = Number(data.orders ?? 0)

      setCurrentPnL(pnl)
      setOrderCount(orders)

      setPnlHistory(prev => [
        ...prev.slice(-30),
        { time: new Date().toLocaleTimeString(), pnl }
      ])

      // 🔥 KILL SWITCH TRIGGER
      if (
        !killInProgressRef.current &&
        (pnl <= Number(config.max_loss) ||
          orders >= Number(config.max_orders))
      ) {
        killInProgressRef.current = true
        setKillTriggeredToday(true)

        await fetch('/api/kill/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id
          },
          body: JSON.stringify({
            user_id: user.id,
            pnl,
            orders
          })
        })
      }
    } catch {
      // silent
    }
  }, [config])

  useEffect(() => {
    const id = setInterval(fetchLiveStats, 5000)
    return () => clearInterval(id)
  }, [fetchLiveStats])

  /* ================= SAVE & LOCK ================= */

  const handleSave = async () => {
    if (lockedToday || saving) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('trading_configs')
      .update({
        max_loss: Number(config.max_loss),
        max_orders: Number(config.max_orders),
        daily_lock_date: todayISO()
      })
      .eq('user_id', user.id)

    setConfig(c => ({ ...c, daily_lock_date: todayISO() }))
    setSaving(false)
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Risk Control Center
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Live intraday protection
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <span className="text-sm font-semibold text-emerald-800">
              {lockedToday ? 'Locked' : 'Monitoring'}
            </span>
          </div>
        </div>

        {killTriggeredToday && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">
              Risk limits breached — Kill switch activated
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Stat
            label="Current P&L"
            value={`₹${currentPnL.toFixed(2)}`}
            accent={currentPnL < 0 ? 'red' : 'green'}
          />
          <Stat label="Orders Executed" value={orderCount} />
          <Stat
            label="Kill Switch"
            value={killTriggeredToday ? 'Triggered' : 'Active'}
            accent={killTriggeredToday ? 'red' : 'green'}
          />
        </div>

        <Card>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={pnlHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
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

        <Card>
          <Input
            label="Max Loss (₹)"
            value={config.max_loss}
            disabled={lockedToday}
            onChange={v => setConfig(c => ({ ...c, max_loss: v }))}
          />
          <Input
            label="Max Orders"
            value={config.max_orders}
            disabled={lockedToday}
            onChange={v => setConfig(c => ({ ...c, max_orders: v }))}
          />
          <button
            onClick={handleSave}
            disabled={lockedToday || saving}
            className={`w-full mt-4 py-3 rounded-xl font-semibold ${
              lockedToday
                ? 'bg-slate-200 text-slate-500'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {lockedToday ? 'Locked for Today' : 'Save & Lock'}
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
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          accent === 'red'
            ? 'text-red-600'
            : accent === 'green'
            ? 'text-emerald-600'
            : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function Input({
  label,
  value,
  disabled,
  onChange
}: {
  label: string
  value: string
  disabled?: boolean
  onChange?: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-slate-500 uppercase mb-1">
        {label}
      </label>
      <input
        value={value}
        disabled={disabled}
        onChange={e => onChange?.(e.target.value)}
        className={`w-full rounded-xl border px-4 py-2 text-sm ${
          disabled
            ? 'bg-slate-100 text-black opacity-100 cursor-not-allowed'
            : 'bg-white text-black border-slate-300 focus:ring-2 focus:ring-slate-900/10'
        }`}
      />
    </div>
  )
}
