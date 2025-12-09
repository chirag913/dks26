// app/admin/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface AnalyticsData {
  totalUsers: number
  totalSubscriptions: number
  recentUsers: any[]
  recentSubscriptions: any[]
  revenue: number
  dailyStats: {
    newUsers: number
    newSubscriptions: number
    killSwitchActivations: number
    trades: number
  }
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== 'sharma.chirag913@gmail.com') {
        router.push('/admin/login')
      }
    }
    checkAdmin()
  }, [supabase, router])

  useEffect(() => {
    async function fetchData() {
      try {
        // Calculate date for last 24 hours
        const twentyFourHoursAgo = new Date()
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

        // Fetch users
        const { data: users } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        // Fetch subscriptions
        const { data: subscriptions } = await supabase
          .from('subscriptions')
          .select('*')
          .order('created_at', { ascending: false })

        // Fetch kill switch events
        const { data: killSwitchEvents } = await supabase
          .from('kill_switch_events')
          .select('*')

        // Fetch trades
        const { data: trades } = await supabase
          .from('trades')
          .select('*')

        // Calculate daily stats
        const dailyStats = {
          newUsers: users?.filter(
            user => new Date(user.created_at) >= twentyFourHoursAgo
          ).length || 0,
          newSubscriptions: subscriptions?.filter(
            sub => new Date(sub.created_at) >= twentyFourHoursAgo
          ).length || 0,
          killSwitchActivations: killSwitchEvents?.filter(
            event => new Date(event.created_at) >= twentyFourHoursAgo
          ).length || 0,
          trades: trades?.filter(
            trade => new Date(trade.created_at) >= twentyFourHoursAgo
          ).length || 0
        }

        const totalRevenue = subscriptions?.reduce((sum, sub) => sum + (sub.total_amount || 0), 0) || 0

        setData({
          totalUsers: users?.length || 0,
          totalSubscriptions: subscriptions?.length || 0,
          recentUsers: users?.slice(0, 5) || [],
          recentSubscriptions: subscriptions?.slice(0, 5) || [],
          revenue: totalRevenue / 100, // Convert from paisa to rupees
          dailyStats
        })
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  if (!data) {
    return <div className="p-8">Error loading data</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Total Users</h3>
            <p className="text-3xl font-bold text-gray-900">{data.totalUsers}</p>
            <p className="text-sm text-gray-500 mt-1">
              +{data.dailyStats.newUsers} New (24h)
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Total Subscriptions</h3>
            <p className="text-3xl font-bold text-gray-900">{data.totalSubscriptions}</p>
            <p className="text-sm text-gray-500 mt-1">
              +{data.dailyStats.newSubscriptions} New (24h)
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Total Revenue</h3>
            <p className="text-3xl font-bold text-gray-900">₹{data.revenue.toFixed(2)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Kill Switch Events</h3>
            <p className="text-3xl font-bold text-red-600">{data.dailyStats.killSwitchActivations}</p>
            <p className="text-sm text-gray-500 mt-1">Last 24 hours</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Users</h3>
              <div className="space-y-4">
                {data.recentUsers.map((user) => (
                  <div key={user.id} className="flex justify-between items-center border-b pb-2 last:border-b-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.email}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(user.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Subscriptions</h3>
              <div className="space-y-4">
                {data.recentSubscriptions.map((sub) => (
                  <div key={sub.id} className="flex justify-between items-center border-b pb-2 last:border-b-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        ₹{(sub.total_amount / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(sub.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      sub.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Stats Section */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Last 24 Hours</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{data.dailyStats.newUsers}</p>
              <p className="text-sm text-gray-500">New Users</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{data.dailyStats.newSubscriptions}</p>
              <p className="text-sm text-gray-500">New Subscriptions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{data.dailyStats.killSwitchActivations}</p>
              <p className="text-sm text-gray-500">Kill Switch Events</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{data.dailyStats.trades}</p>
              <p className="text-sm text-gray-500">Total Trades</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}