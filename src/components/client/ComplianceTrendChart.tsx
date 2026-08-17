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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD9EA" />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          style={{ fontSize: '12px', fill: '#54657B' }}
        />
        <YAxis
          domain={[0, 100]}
          axisLine={false}
          tickLine={false}
          style={{ fontSize: '12px', fill: '#54657B' }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(11,31,58,0.12)' }}
          formatter={(value) => [`${value}%`, 'Conformidade']}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#0F6B78"
          strokeWidth={3}
          dot={{ r: 4, fill: '#0F6B78', strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
