// ============================================================================
// Shared UI components
// ============================================================================
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'teal' }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    teal: 'bg-teal-100 text-teal-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>{children}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { color: string; icon: ReactNode }> = {
    Critical: { color: 'red', icon: <XCircle className="w-3 h-3 mr-1" /> },
    High: { color: 'red', icon: <AlertTriangle className="w-3 h-3 mr-1" /> },
    Medium: { color: 'yellow', icon: <AlertTriangle className="w-3 h-3 mr-1" /> },
    Low: { color: 'blue', icon: <Info className="w-3 h-3 mr-1" /> },
  };
  const s = map[severity] || map.Low;
  return (
    <Badge color={s.color as 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'teal'}>
      <span className="inline-flex items-center">{s.icon}{severity}</span>
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'gray' | 'green' | 'blue' | 'yellow' | 'red'> = {
    Open: 'yellow',
    Reviewed: 'blue',
    Resolved: 'green',
    Ignored: 'gray',
    pass: 'green',
    warn: 'yellow',
    fail: 'red',
  };
  return <Badge color={map[status] || 'gray'}>{status}</Badge>;
}

export function MetricCard({
  label,
  value,
  icon,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  sub?: string;
  tone?: 'default' | 'green' | 'red' | 'yellow';
}) {
  const toneClass = {
    default: 'border-l-blue-400',
    green: 'border-l-green-400',
    red: 'border-l-red-400',
    yellow: 'border-l-yellow-400',
  }[tone];
  return (
    <Card className={`p-4 border-l-4 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </Card>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200',
    ghost: 'text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-gray-300 mb-4">{icon}</div>}
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-700 flex-1">{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-red-400 hover:text-red-600">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        {message && <p className="text-sm text-gray-500">{message}</p>}
      </div>
    </div>
  );
}

export function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return <CheckCircle2 className={className} />;
}

export function InfoIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return <Info className={className} />;
}
