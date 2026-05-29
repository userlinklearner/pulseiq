'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { DailyMetrics } from '@/types'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-black/90 border border-white/10 rounded-lg p-3 text-xs space-y-1">
      <p className="text-white/60 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/70">{p.name}:</span>
          <span className="text-white font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  data: DailyMetrics[]
  days?: number
}

export function HRVChart({ data, days = 30 }: Props) {
  const recent = data.slice(-days).filter(d => d.hrv_avg !== null)

  const avg = recent.length
    ? Math.round(recent.reduce((s, d) => s + (d.hrv_avg ?? 0), 0) / recent.length)
    : null

  const chartData = recent.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    HRV:  d.hrv_avg ? Math.round(d.hrv_avg) : null,
    RHR:  d.resting_hr ?? null,
  }))

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {avg && (
            <ReferenceLine
              y={avg}
              stroke="rgba(16,185,129,0.3)"
              strokeDasharray="4 4"
              label={{ value: `avg ${avg}`, fill: 'rgba(16,185,129,0.6)', fontSize: 10, position: 'right' }}
            />
          )}
          <Line
            type="monotone" dataKey="HRV" stroke="#10b981"
            strokeWidth={2} dot={false} connectNulls
          />
          <Line
            type="monotone" dataKey="RHR" stroke="#f43f5e"
            strokeWidth={1.5} dot={false} connectNulls strokeDasharray="3 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
