export type DeviceType = 'oura' | 'whoop' | 'garmin' | 'manual'

export interface ConnectedDevice {
  id: string
  user_id: string
  device_type: DeviceType
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  last_synced_at: string | null
  meta: Record<string, unknown>
  created_at: string
}

export interface DailyMetrics {
  id: string
  user_id: string
  date: string
  source: DeviceType
  sleep_hours: number | null
  sleep_deep_minutes: number | null
  sleep_rem_minutes: number | null
  sleep_light_minutes: number | null
  sleep_score: number | null
  hrv_avg: number | null
  resting_hr: number | null
  recovery_score: number | null
  spo2_avg: number | null
  spo2_low: number | null
  strain_score: number | null
  stress_avg: number | null
  body_battery_wake: number | null
  body_battery_end: number | null
  steps: number | null
  active_calories: number | null
}

export interface Activity {
  id: string
  user_id: string
  source: DeviceType
  external_id: string | null
  started_at: string
  duration_secs: number | null
  activity_type: string | null
  distance_meters: number | null
  calories: number | null
  avg_hr: number | null
  max_hr: number | null
  notes: string | null
}

export interface ManualEntry {
  id: string
  user_id: string
  date: string
  mood: number | null
  energy: number | null
  soreness: number | null
  motivation: number | null
  activity_type: string | null
  duration_mins: number | null
  rpe: number | null
  notes: string | null
}

export interface Profile {
  id: string
  display_name: string | null
  birth_year: number | null
  primary_sport: string | null
  goal: string | null
  avatar_url: string | null
}

// Unified day view (merged across all sources)
export interface DaySummary {
  date: string
  metrics: DailyMetrics[]
  activities: Activity[]
  manual: ManualEntry | null
  // Computed best values
  best_sleep_hours: number | null
  best_hrv: number | null
  best_resting_hr: number | null
  best_recovery_score: number | null
}
