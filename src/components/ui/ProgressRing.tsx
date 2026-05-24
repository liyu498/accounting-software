import { cn } from '../../lib/utils'

interface ProgressRingProps {
  progress: number  // 0-100
  size?: number
  strokeWidth?: number
  className?: string
  color?: 'primary' | 'success' | 'warning' | 'danger'
  label?: string
  subLabel?: string
}

const colorMap = {
  primary: {
    stroke: '#3b82f6',
    bg: '#e0e7ff',
  },
  success: {
    stroke: '#22c55e',
    bg: '#dcfce7',
  },
  warning: {
    stroke: '#f59e0b',
    bg: '#fef3c7',
  },
  danger: {
    stroke: '#ef4444',
    bg: '#fee2e2',
  },
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  className,
  color = 'primary',
  label,
  subLabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  const colors = colorMap[color]

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.bg}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{progress}%</span>
        </div>
      </div>
      {label && (
        <div className="mt-2 text-center">
          <p className="text-sm font-medium text-gray-700">{label}</p>
          {subLabel && <p className="text-xs text-gray-500">{subLabel}</p>}
        </div>
      )}
    </div>
  )
}
