import { cn, scoreColor, scoreBg } from '@/lib/utils'
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number | null
  unit?: string
  score?: number | null
  scoreInverted?: boolean
  icon: LucideIcon
  iconColor?: string
  subtitle?: string
  trend?: { value: number; label: string }
  className?: string
}

export function MetricCard({
  title, value, unit, score, scoreInverted = false,
  icon: Icon, iconColor = 'text-white/60',
  subtitle, trend, className
}: MetricCardProps) {
  const hasScore = score !== null && score !== undefined

  return (
    <Card className={cn('relative overflow-hidden', hasScore && scoreBg(score, scoreInverted), className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1.5">
          <span className={cn(
            'text-3xl font-bold tabular-nums',
            hasScore ? scoreColor(score, scoreInverted) : 'text-white'
          )}>
            {value ?? '--'}
          </span>
          {unit && <span className="text-sm text-white/40 mb-0.5">{unit}</span>}
        </div>
        {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 mt-2 text-xs',
            trend.value > 0 ? 'text-emerald-400' : trend.value < 0 ? 'text-red-400' : 'text-white/40'
          )}>
            <span>{trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'}</span>
            <span>{Math.abs(trend.value)} {trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
