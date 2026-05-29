import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  })
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export function scoreColor(score: number | null, inverted = false): string {
  if (score === null) return 'text-gray-400'
  const val = inverted ? 100 - score : score
  if (val >= 70) return 'text-emerald-400'
  if (val >= 40) return 'text-amber-400'
  return 'text-red-400'
}

export function scoreBg(score: number | null, inverted = false): string {
  if (score === null) return 'bg-gray-800'
  const val = inverted ? 100 - score : score
  if (val >= 70) return 'bg-emerald-500/20 border-emerald-500/30'
  if (val >= 40) return 'bg-amber-500/20 border-amber-500/30'
  return 'bg-red-500/20 border-red-500/30'
}

export const DEVICE_LABELS: Record<string, string> = {
  oura: 'Oura Ring',
  whoop: 'Whoop',
  garmin: 'Garmin',
  manual: 'Manual',
}

export const DEVICE_COLORS: Record<string, string> = {
  oura: '#6366f1',
  whoop: '#f43f5e',
  garmin: '#06b6d4',
  manual: '#84cc16',
}

export const ACTIVITY_ICONS: Record<string, string> = {
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
  strength: '🏋️',
  yoga: '🧘',
  walking: '🚶',
  hiking: '⛰️',
  rowing: '🚣',
  default: '⚡',
}

export function activityIcon(type: string | null): string {
  if (!type) return ACTIVITY_ICONS.default
  const key = type.toLowerCase()
  return ACTIVITY_ICONS[key] ?? ACTIVITY_ICONS.default
}
