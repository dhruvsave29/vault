"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

// Types and Enums
enum Strength {
  None = "none",
  Weak = "weak",
  Moderate = "moderate",
  Strong = "strong",
}

interface FinancialScoreProps {
  title: string
  description: string
  initialScore?: number
  icon?: React.ReactNode
  color: string
}

interface FinancialScoreDisplayProps {
  value: Score
  max: number
}

interface FinancialScoreHalfCircleProps {
  value: Score
  max: number
  color: string
}

interface FinancialScoreHeaderProps {
  title?: string
  strength?: Strength
  icon?: React.ReactNode
}

type CounterContextType = {
  getNextIndex: () => number
}

type Score = number | null
type StrengthColors = Record<Strength, string[]>

// Utils Class
class Utils {
  static LOCALE = "en-US"

  static easings = {
    easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    easeOut: "cubic-bezier(0.33, 1, 0.68, 1)",
  }

  static circumference(r: number): number {
    return 2 * Math.PI * r
  }

  static formatNumber(n: number) {
    return new Intl.NumberFormat(this.LOCALE).format(n)
  }

  static getStrength(score: Score, maxScore: number): Strength {
    if (!score) return Strength.None

    const percent = score / maxScore

    if (percent >= 0.8) return Strength.Strong
    if (percent >= 0.4) return Strength.Moderate

    return Strength.Weak
  }

  static randomHash(length = 4): string {
    const chars = "abcdef0123456789"
    const bytes = crypto.getRandomValues(new Uint8Array(length))

    return [...bytes].map((b) => chars[b % chars.length]).join("")
  }

  static randomInt(min = 0, max = 1): number {
    const value = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

    return Math.round(min + (max - min) * value)
  }
}

// Context
const CounterContext = createContext<CounterContextType | undefined>(undefined)

const CounterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const counterRef = useRef(0)
  const getNextIndex = useCallback(() => {
    return counterRef.current++
  }, [])

  return <CounterContext.Provider value={{ getNextIndex }}>{children}</CounterContext.Provider>
}

const useCounter = () => {
  const context = useContext(CounterContext)

  if (!context) {
    throw new Error("useCounter must be used within a CounterProvider")
  }

  return context.getNextIndex
}

// Components
function BrutalCard({ children, className }: { children: React.ReactNode, className?: string }) {
  const getNextIndex = useCounter()
  const indexRef = useRef<number | null>(null)
  const animationRef = useRef(0)
  const [appearing, setAppearing] = useState(false)

  if (indexRef.current === null) {
    indexRef.current = getNextIndex()
  }

  useEffect(() => {
    const delayInc = 200
    const delay = 300 + indexRef.current! * delayInc

    animationRef.current = setTimeout(() => setAppearing(true), delay) as any

    return () => {
      clearTimeout(animationRef.current)
    }
  }, [])

  if (!appearing) return null

  return (
    <div className={`w-full max-w-md bg-card border-brutal shadow-brutal transform md:-translate-y-4 hover:-translate-y-6 transition-transform animate-in fade-in slide-in-from-bottom-8 duration-800 fill-mode-both ${className}`}>
      <div className="p-8 h-full flex flex-col">{children}</div>
    </div>
  )
}

function FinancialScoreDisplay({ value, max }: FinancialScoreDisplayProps) {
  const hasValue = value !== null
  const digits = String(Math.floor(value!)).split("")
  const maxFormatted = Utils.formatNumber(max)
  const label = hasValue ? `out of ${maxFormatted}` : "No score"

  return (
    <div className="absolute bottom-0 w-full text-center">
      <div className="text-4xl font-heading font-black h-12 overflow-hidden relative">
        <div className="absolute inset-0 opacity-0">
          <div className="inline-block">0</div>
        </div>
        <div className="absolute inset-0">
          {hasValue &&
            digits.map((digit, i) => (
              <span
                key={i}
                className="inline-block animate-in slide-in-from-bottom-full duration-800 delay-400 fill-mode-both"
                style={{
                  animationDelay: `${400 + i * 100}ms`,
                  animationDuration: `${800 + i * 300}ms`,
                }}
              >
                {digit}
              </span>
            ))}
        </div>
      </div>
      <div className="text-sm font-mono font-bold uppercase tracking-wide border-t-2 border-border inline-block pt-1 text-text-muted">{label}</div>
    </div>
  )
}

function FinancialScoreHalfCircle({ value, max, color }: FinancialScoreHalfCircleProps) {
  const strokeRef = useRef<SVGCircleElement>(null)
  const radius = 45
  const dist = Utils.circumference(radius)
  const distHalf = dist / 2
  const distFourth = distHalf / 2
  const strokeDasharray = `${distHalf} ${distHalf}`
  const distForValue = Math.min((value as number) / max, 1) * -distHalf
  const strokeDashoffset = value !== null ? distForValue : -distFourth

  useEffect(() => {
    const strokeStart = 400
    const duration = 1400

    strokeRef.current?.animate(
      [
        { strokeDashoffset: "0", offset: 0 },
        { strokeDashoffset: "0", offset: strokeStart / duration },
        { strokeDashoffset: strokeDashoffset.toString() },
      ],
      {
        duration,
        easing: Utils.easings.easeInOut,
        fill: "forwards",
      },
    )
  }, [value, max, strokeDashoffset])

  return (
    <svg className="block mx-auto w-auto max-w-full h-36" viewBox="0 0 100 50" aria-hidden="true">
      <g fill="none" strokeWidth="10" transform="translate(50, 50.5)">
        <circle className="stroke-white/5" r={radius} />
        <circle 
          ref={strokeRef} 
          stroke={color} 
          strokeDasharray={strokeDasharray} 
          r={radius} 
          strokeLinecap="square"
          className="stroke-black" 
          style={{ stroke: 'rgba(15,16,25,1)', strokeWidth: 14 }} // Brutalist thick black background stroke
        />
        <circle 
          ref={strokeRef} 
          stroke={color} 
          strokeDasharray={strokeDasharray} 
          r={radius} 
          strokeLinecap="square"
        />
      </g>
    </svg>
  )
}

function FinancialScoreHeader({ title, strength, icon }: FinancialScoreHeaderProps) {
  const hasStrength = strength !== Strength.None

  const getBadgeClassName = (strength: Strength) => {
    switch (strength) {
      case Strength.Weak:
        return "bg-rose text-void border-2 border-rose shadow-[2px_2px_0px_0px_rgba(251,113,133,0.3)]"
      case Strength.Moderate:
        return "bg-amber text-void border-2 border-amber shadow-[2px_2px_0px_0px_rgba(251,191,36,0.3)]"
      case Strength.Strong:
        return "bg-emerald text-void border-2 border-emerald shadow-[2px_2px_0px_0px_rgba(52,211,153,0.3)]"
      default:
        return "bg-surface text-text-primary border-2 border-border shadow-[2px_2px_0px_0px_rgba(129,140,248,0.15)]"
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8 animate-in fade-in slide-in-from-bottom-12 duration-800 delay-0">
      <div className="flex justify-between items-start">
        <div className="w-16 h-16 border-brutal bg-surface shadow-brutal-sm flex items-center justify-center">
           {icon}
        </div>
        {hasStrength && strength && (
          <div
            className={`px-3 py-1 uppercase text-xs font-heading font-black animate-in fade-in slide-in-from-bottom-12 duration-800 delay-800 ${getBadgeClassName(strength)}`}
          >
            {strength}
          </div>
        )}
      </div>
      <h2 className="text-3xl font-heading font-black uppercase tracking-tighter text-text-primary">{title}</h2>
    </div>
  )
}

function FinancialScore({ title, description, initialScore, icon, color }: FinancialScoreProps) {
  const [score, setScore] = useState<Score>(initialScore ?? null)
  const hasScore = score !== null
  const max = 100
  const strength = Utils.getStrength(score, max)

  function handleGenerateScore(): void {
    if (!hasScore) {
      setScore(Utils.randomInt(0, max))
    }
  }

  return (
    <BrutalCard className={color === '#818cf8' ? 'bg-card' : color === '#34d399' ? 'bg-card md:translate-y-8 hover:translate-y-6' : 'bg-card md:translate-y-4 hover:translate-y-2'}>
      <FinancialScoreHeader title={title} strength={strength} icon={icon} />
      <div className="relative mb-8 animate-in fade-in slide-in-from-bottom-12 duration-800 delay-100 bg-surface border-brutal p-4">
        <FinancialScoreHalfCircle value={score} max={max} color={color} />
        <FinancialScoreDisplay value={score} max={max} />
      </div>
      <p className="font-mono text-base flex-grow mb-6 animate-in fade-in slide-in-from-bottom-12 duration-800 delay-200 text-text-muted">
        {description}
      </p>
      <button
        onClick={handleGenerateScore}
        className="w-full bg-indigo text-void py-4 uppercase font-heading font-black text-xl hover:bg-violet hover:text-void border-brutal border-indigo transition-colors"
      >
        {hasScore ? "ANALYZE METRIC" : "CALCULATE SCORE"}
      </button>
    </BrutalCard>
  )
}

interface MetricsScoreCardsProps {
  data: FinancialScoreProps[]
}

// Main Component
export function MetricsScoreCards({ data }: MetricsScoreCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto items-stretch">
      <CounterProvider>
        {data.map((card, i) => (
          <FinancialScore key={i} {...card} />
        ))}
      </CounterProvider>
    </div>
  )
}
