import { Activity } from '@/types'
import { formatDuration, formatDistance, activityIcon } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props { activities: Activity[]; limit?: number }

export function ActivityFeed({ activities, limit = 10 }: Props) {
  const recent = activities.slice(0, limit)

  if (!recent.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-white/30 text-sm">
          No activities yet — connect a device or log a workout.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {recent.map(a => (
          <div
            key={a.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <span className="text-xl flex-shrink-0">{activityIcon(a.activity_type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate capitalize">
                {a.activity_type ?? 'Workout'}
              </p>
              <p className="text-xs text-white/40">
                {new Date(a.started_at).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {a.duration_secs && (
                <span className="text-xs text-white/60">{formatDuration(a.duration_secs)}</span>
              )}
              {a.distance_meters && a.distance_meters > 0 && (
                <Badge variant="info">{formatDistance(a.distance_meters)}</Badge>
              )}
              {a.avg_hr && (
                <Badge variant="warning">{a.avg_hr} bpm</Badge>
              )}
              <Badge variant="default" className="capitalize">{a.source}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
