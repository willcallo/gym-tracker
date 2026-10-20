import Link from 'next/link';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

// White on #009276 is ~3.9:1, which passes only as large bold text, so primary is always text-lg+.
export function btn(variant: ButtonVariant = 'primary', size: 'md' | 'lg' = 'md') {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold select-none transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const sizes = {
    md: 'min-h-12 px-5 rounded-xl',
    lg: 'min-h-16 px-6 rounded-2xl',
  };
  const text = size === 'lg' ? 'text-xl' : variant === 'primary' ? 'text-lg' : 'text-base';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brand text-white active:bg-brand-ink',
    secondary: 'border border-gray-300 bg-white text-gray-900 active:bg-gray-100',
    danger: 'border border-red-300 bg-white text-red-700 active:bg-red-50',
    ghost: 'text-brand-ink active:bg-brand-soft',
  };
  return `${base} ${sizes[size]} ${text} ${variants[variant]}`;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${btn(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`rounded-2xl border border-gray-200 bg-white p-4 ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-600">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">{children}</h2>;
}

export function Chip({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'brand';
  children: React.ReactNode;
}) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-700',
    brand: 'bg-brand-soft text-brand-ink',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-gray-600">
      {children}
    </div>
  );
}

export const inputCls =
  'h-12 w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand/40';

export const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700';
