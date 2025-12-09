// app/analytics/page.tsx
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AnalyticsOverview {
  totalSignups: number
  totalSubscriptions: number
  totalTrades: number
  killSwitchActivations: number
  dailyReport: {
    orders: number
    killSwitchActivations: number
  }
  paidSignups: number
}

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<any[]>([])
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchData() {
      try {
        // Get signups (users created in last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // Fetch comprehensive analytics
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('id, created_at, email')

        const { data: subscriptions, error: subscriptionsError } = await supabase
          .from('subscriptions')
          .select('id, user_id, created_at, total_amount, status')

        const { data: trades, error: tradesError } = await supabase
          .from('trades')
          .select('id, created_at')

        const { data: killSwitchEvents, error: killSwitchError } = await supabase
          .from('kill_switch_events')
          .select('id, created_at')

        // Validate all queries
        if (usersError) throw usersError
        if (subscriptionsError) throw subscriptionsError
        if (tradesError) throw tradesError
        if (killSwitchError) throw killSwitchError

        // Process daily data
        const dailyData: { [key: string]: any } = {}

        // Daily analytics processing
        users?.forEach((user) => {
          const date = format(new Date(user.created_at), 'yyyy-MM-dd')
          if (!dailyData[date]) {
            dailyData[date] = { 
              date, 
              signups: 0, 
              paidSignups: 0, 
              revenue: 0 
            }
          }
          dailyData[date].signups++
        })

        // Add paid signups and revenue
        subscriptions?.forEach((sub) => {
          const user = users?.find(u => u.id === sub.user_id)
          if (user) {
            const date = format(new Date(user.created_at), 'yyyy-MM-dd')
            if (dailyData[date] && sub.status === 'active') {
              dailyData[date].paidSignups++
              dailyData[date].revenue += sub.total_amount / 100 // Convert from paisa to rupees
            }
          }
        })

        // Sort and process daily data
        const sortedData = Object.values(dailyData).sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        // Prepare overview
        const overviewData: AnalyticsOverview = {
          totalSignups: users?.length || 0,
          totalSubscriptions: subscriptions?.filter(sub => sub.status === 'active').length || 0,
          totalTrades: trades?.length || 0,
          killSwitchActivations: killSwitchEvents?.length || 0,
          dailyReport: {
            orders: subscriptions?.length || 0,
            killSwitchActivations: killSwitchEvents?.filter(
              event => new Date(event.created_at) >= thirtyDaysAgo
            ).length || 0
          },
          paidSignups: subscriptions?.filter(sub => sub.status === 'active').length || 0
        }

        setAnalyticsData(sortedData)
        setOverview(overviewData)
      } catch (error) {
        console.error('Error fetching analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  if (loading) {
    return <div className="p-4">Loading analytics...</div>
  }

  if (!overview) {
    return <div className="p-4">Error loading analytics data</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Logo and Title Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-center space-x-4 mb-6">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 100 100" 
            className="w-16 h-16 text-black"
          >
            <path 
              d="M50 10 L90 50 L50 90 L10 50 Z" 
              fill="currentColor" 
              stroke="currentColor" 
              strokeWidth="5"
            />
            <path 
              d="M50 30 L70 50 L50 70 L30 50 Z" 
              fill="white" 
              stroke="white" 
              strokeWidth="3"
            />
          </svg>
          <h1 className="text-4xl font-bold text-gray-900">Killswitch PRO</h1>
        </div>
        <div className="text-center mb-8">
          <p className="text-xl text-gray-600">Analytics Dashboard</p>
        </div>
      </div>
      
      {/* Overall Stats */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-gray-700">Total Signups</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{overview.totalSignups}</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-gray-700">Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{overview.totalSubscriptions}</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-gray-700">Total Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{overview.totalTrades}</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-gray-700">Kill Switch Activations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{overview.killSwitchActivations}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Daily Reports Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Report Card */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-gray-800">Daily Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Total Orders</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {overview.dailyReport.orders}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Kill Switch Activations</span>
                  <span className="text-2xl font-bold text-red-600">
                    {overview.dailyReport.killSwitchActivations}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Paid Signups Card */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-gray-800">Paid Signups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Total Paid Signups</span>
                  <span className="text-3xl font-bold text-green-600">
                    {overview.paidSignups}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Daily Signups & Revenue Chart */}
      <div className="max-w-7xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-gray-800">Daily Signups & Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'MMM d')}
                    stroke="#666"
                  />
                  <YAxis 
                    yAxisId="left" 
                    stroke="#2563eb"
                    label={{ value: 'Signups', angle: -90, position: 'insideLeft', fill: "#2563eb" }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#16a34a"
                    label={{ value: 'Revenue (₹)', angle: 90, position: 'insideRight', fill: "#16a34a" }}
                  />
                  <Tooltip 
                    labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
                  />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="signups" 
                    stroke="#2563eb" 
                    name="Total Signups"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="paidSignups" 
                    stroke="#8884d8" 
                    name="Paid Signups"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#16a34a" 
                    name="Revenue (₹)"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}