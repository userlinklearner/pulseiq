'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { DailyMetrics } from '@/types'

interface Props { data: DailyMetrics[]; days?: number }

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div className="bg-black/90 border border-white/10 rounded-lg p-3 text-xs">
      <p className="text-white/60 mb-1">{label}</p>
      <p className="text-white font-bold">{val} <span className="text-white/40">/ 100</span></p>
    </div>
  )
}

function barColor(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function RecoveryChart({ data, days = 14 }: Props) {
  const recent = data.slice(-days).filter(d => d.recovery_score !== null)

  const chartData = recent.map(d => ({
    date:  new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: d.recovery_score ?? 0,
  }))

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.score)} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
