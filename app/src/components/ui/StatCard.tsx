import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'same';
  trendValue?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
  trendValue,
  className = '',
}) => {
  return (
    <div className={`card-base p-4 flex flex-col justify-between ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold font-mono mt-1 text-text-primary">{value}</h3>
        </div>
        {icon && (
          <div className="p-2 bg-bg-secondary rounded-lg border border-border-default text-gold-400">
            {icon}
          </div>
        )}
      </div>
      {(description || trend) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-subtle text-xs text-text-secondary">
          {trend && (
            <span className={`inline-flex items-center font-bold font-mono ${
              trend === 'up' ? 'text-rank-up' : trend === 'down' ? 'text-rank-down' : 'text-rank-same'
            }`}>
              {trend === 'up' ? (
                <ArrowUp className="w-3.5 h-3.5 mr-0.5" />
              ) : trend === 'down' ? (
                <ArrowDown className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <Minus className="w-3.5 h-3.5 mr-0.5" />
              )}
              {trendValue}
            </span>
          )}
          {description && <span>{description}</span>}
        </div>
      )}
    </div>
  );
};
