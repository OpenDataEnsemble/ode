import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

export default function Badge({
  variant = 'primary',
  size = 'md',
  children,
  className,
}: BadgeProps): ReactNode {
  return (
    <span
      className={clsx(
        styles.badge,
        styles[`badge--${variant}`],
        styles[`badge--${size}`],
        className
      )}
    >
      {children}
    </span>
  );
}

