import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';

interface PricePoint {
  name: string;
  value: number;
}

export const PriceChart = ({ data, title = 'Price trend' }: { data: PricePoint[]; title?: string }) => (
  <Card className="p-5">
    <h3 className="mb-4 text-base font-bold text-slate-900">{title}</h3>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#047857" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

