import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';
type AlertSize = 'sm' | 'md';

interface AlertProps {
  variant?: AlertVariant;
  size?: AlertSize;
  title?: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export default function Alert({
  variant = 'info',
  size = 'md',
  title,
  children,
  className,
  icon,
}: AlertProps): ReactNode {
  const defaultIcons = {
    info: 'ℹ️',
    success: '✓',
    warning: '⚠',
    error: '✕',
  };

  return (
    <div
      className={clsx(
        styles.alert,
        styles[`alert--${variant}`],
        styles[`alert--${size}`],
        className
      )}
      role="alert"
    >
      <div className={styles.alertIcon}>
        {icon || <span className={styles.iconEmoji}>{defaultIcons[variant]}</span>}
      </div>
      <div className={styles.alertContent}>
        {title && <div className={styles.alertTitle}>{title}</div>}
        <div className={styles.alertMessage}>{children}</div>
      </div>
    </div>
  );
}

