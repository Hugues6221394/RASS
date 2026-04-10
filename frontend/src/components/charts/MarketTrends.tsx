import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';

export const MarketTrends = ({ data }: { data: Array<{ name: string; value: number }> }) => (
  <Card className="p-5">
    <h3 className="mb-4 text-base font-bold text-slate-900">Market trend intensity</h3>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#0EA5A4" fill="#99F6E4" fillOpacity={0.8} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

