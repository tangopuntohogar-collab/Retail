import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Receipt } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  trend: number;
  subtitle: string;
  icon: 'money' | 'percent' | 'ticket';
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, trend, subtitle, icon }) => {
  const Icon = icon === 'money' ? DollarSign : icon === 'percent' ? Percent : Receipt;
  const isPositive = trend >= 0;

  return (
    <div className="bg-card-dark rounded-xl border border-border-dark p-8 shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon size={100} className="text-primary" />
      </div>
      <div className="flex flex-col gap-1 relative z-10">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-bold text-white">{value}</h3>
          <span className={`flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${isPositive ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
            {isPositive ? <TrendingUp size={14} className="mr-0.5" /> : <TrendingDown size={14} className="mr-0.5" />}
            {isPositive ? '+' : ''}{trend}%
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
      </div>
    </div>
  );
};
