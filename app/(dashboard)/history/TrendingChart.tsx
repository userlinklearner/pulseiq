'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { DailyMetrics } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface Props { data: DailyMetrics[] }

export function TrendingChart({ data }: Props) {
  // Weekly aggregation
  const byWeek: Record<string, { hrv: number[]; steps: number[]; sleep: number[] }> = {}

  for (const d of data) {
    const date = new Date(d.date)
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    const key = startOfWeek.toISOString().split('T')[0]

    if (!byWeek[key]) byWeek[key] = { hrv: [], steps: [], sleep: [] }
    if (d.hrv_avg)     byWeek[key].hrv.push(d.hrv_avg)
    if (d.steps)       byWeek[key].steps.push(d.steps)
    if (d.sleep_hours) byWeek[key].sleep.push(d.sleep_hours)
  }

  const chartData = Object.entries(byWeek).slice(-12).map(([week, vals]) => ({
    week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Avg HRV':    vals.hrv.length   ? Math.round(vals.hrv.reduce((a, b) => a + b, 0) / vals.hrv.length)       : null,
    'Avg Steps':  vals.steps.length ? Math.round(vals.steps.reduce((a, b) => a + b, 0) / vals.steps.length)   : null,
    'Avg Sleep':  vals.sleep.length ? Number((vals.sleep.reduce((a, b) => a + b, 0) / vals.sleep.length).toFixed(1)) : null,
  }))

  if (!chartData.length) return null

  return (
    <Card>
      <CardHeader><CardTitle>Weekly averages -- last 12 weeks</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left"  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                itemStyle={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
              <Bar yAxisId="left" dataKey="Avg Steps" fill="rgba(99,102,241,0.4)" radius={[3,3,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="Avg HRV"   stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="Avg Sleep" stroke="#a855f7" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
