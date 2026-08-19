import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type CompliancePoint = {
  date: string;
  score: number;
};

export function ComplianceTrendChart({ data }: { data: CompliancePoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface-sunken text-sm text-navy-3">
        Sem dados de conformidade ainda.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          style={{ fontSize: '12px', fill: 'rgb(var(--navy-3))' }}
        />
        <YAxis
          domain={[0, 100]}
          axisLine={false}
          tickLine={false}
          style={{ fontSize: '12px', fill: 'rgb(var(--navy-3))' }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid rgb(var(--border))',
            background: 'rgb(var(--surface))',
            color: 'rgb(var(--navy))',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
          }}
          labelStyle={{ color: 'rgb(var(--navy-2))' }}
          itemStyle={{ color: 'rgb(var(--navy))' }}
          formatter={(value) => [`${value}%`, 'Conformidade']}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="rgb(var(--secondary))"
          strokeWidth={3}
          dot={{ r: 4, fill: 'rgb(var(--secondary))', strokeWidth: 2, stroke: 'rgb(var(--surface))' }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
