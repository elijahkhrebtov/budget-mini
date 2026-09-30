import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatShort } from './dates'

export interface BalancePoint {
  day: string
  total: number
}

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

function fmt(cents: number): string {
  const s = money.format(Math.abs(cents) / 100)
  return cents < 0 ? `−${s}` : s
}

export default function BalanceChart({ data }: { data: BalancePoint[] }) {
  return (
    <section className="panel chart">
      <h2>Balance over time</h2>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 72, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="#eef0f2" />
            <XAxis
              dataKey="day"
              tickFormatter={formatShort}
              ticks={data.filter((p) => p.day.endsWith('-01')).map((p) => p.day)}
              tick={{ fontSize: 12, fill: '#656d76' }}
              axisLine={{ stroke: '#d9dde3' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => compact.format(v / 100)}
              tick={{ fontSize: 12, fill: '#656d76' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <ReferenceLine y={0} stroke="#afb8c1" />
            <Tooltip
              cursor={{ stroke: '#afb8c1', strokeWidth: 1 }}
              isAnimationActive={false}
              labelFormatter={(d) => formatShort(String(d))}
              formatter={(v) => [fmt(Number(v)), 'Balance']}
              contentStyle={{ fontSize: 13, borderRadius: 6, borderColor: '#d9dde3' }}
            />
            <Line
              type="linear"
              dataKey="total"
              stroke="#0969da"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, fill: '#0969da', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
              label={({ x, y, index }) =>
                index === data.length - 1 ? (
                  <text x={Number(x) + 8} y={Number(y)} dy={4} fontSize={12} fontWeight={600} fill="#1f2328">
                    {fmt(data[index].total)}
                  </text>
                ) : null
              }
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
