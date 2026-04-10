import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Card } from '../ui/Card';

interface StatItem {
  label: string;
  value: string;
  icon: ReactNode;
}

export const StatsSection = ({ stats }: { stats: StatItem[] }) => (
  <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {stats.map((item, index) => (
      <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}>
        <Card className="p-5">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            {item.icon}
          </div>
          <p className="text-2xl font-black text-slate-900">{item.value}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{item.label}</p>
        </Card>
      </motion.div>
    ))}
  </section>
);

