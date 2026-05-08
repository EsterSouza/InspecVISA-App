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
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          style={{ fontSize: '12px', fill: '#94a3b8' }}
        />
        <YAxis
          domain={[0, 100]}
          axisLine={false}
          tickLine={false}
          style={{ fontSize: '12px', fill: '#94a3b8' }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          formatter={(value) => [`${value}%`, 'Conformidade']}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#1e6b5e"
          strokeWidth={3}
          dot={{ r: 4, fill: '#1e6b5e', strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
