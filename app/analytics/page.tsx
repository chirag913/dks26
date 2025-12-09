// app/analytics/page.tsx
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchData() {
      try {
        // Get signups (users created in last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString())

        const { data: payments, error: paymentsError } = await supabase
          .from('subscriptions')
          .select('created_at, total_amount')
          .gte('created_at', thirtyDaysAgo.toISOString())

        if (usersError) throw usersError
        if (paymentsError) throw paymentsError

        // Process data by day
        const dailyData: { [key: string]: any } = {}

        users?.forEach((user) => {
          const date = format(new Date(user.created_at), 'yyyy-MM-dd')
          if (!dailyData[date]) {
            dailyData[date] = { date, signups: 0, revenue: 0 }
          }
          dailyData[date].signups++
        })

        payments?.forEach((payment) => {
          const date = format(new Date(payment.created_at), 'yyyy-MM-dd')
          if (!dailyData[date]) {
            dailyData[date] = { date, signups: 0, revenue: 0 }
          }
          dailyData[date].revenue += payment.total_amount / 100 // Convert from paisa to rupees
        })

        const sortedData = Object.values(dailyData).sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        setAnalyticsData(sortedData)
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

  if (!analyticsData) {
    return <div className="p-4">Error loading analytics data</div>
  }

  const totalSignups = analyticsData.reduce((sum: number, day: any) => sum + day.signups, 0)
  const totalRevenue = analyticsData.reduce((sum: number, day: any) => sum + day.revenue, 0)

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>
      
      <div className="grid gap-4 mb-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalSignups}</p>
            <p className="text-sm text-gray-500">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">₹{totalRevenue.toFixed(2)}</p>
            <p className="text-sm text-gray-500">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Signups & Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="signups" 
                  stroke="#2563eb" 
                  name="Signups"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#16a34a" 
                  name="Revenue (₹)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}