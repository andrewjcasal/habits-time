import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  href?: string;
}

export const Stat = ({ title, value, icon: Icon, trend, href }: StatProps) => {
  const StatContent = () => (
    <div className="card bg-white hover:shadow-md transition-shadow p-5">
      <div className="flex justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
          {trend && (
            <p className="text-xs text-neutral-500 mt-1">{trend}</p>
          )}
        </div>
        
        <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary-500" />
        </div>
      </div>
      
      {href && (
        <div className="mt-4 text-primary-600 text-sm font-medium flex items-center">
          View details <ArrowRight className="ml-1 h-3 w-3" />
        </div>
      )}
    </div>
  );
  
  if (href) {
    return (
      <Link to={href}>
        <StatContent />
      </Link>
    );
  }
  
  return <StatContent />;
};