import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type DividerVariant = 'solid' | 'dashed' | 'dotted';
type DividerOrientation = 'horizontal' | 'vertical';

interface DividerProps {
  variant?: DividerVariant;
  orientation?: DividerOrientation;
  spacing?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  children?: ReactNode;
}

export default function Divider({
  variant = 'solid',
  orientation = 'horizontal',
  spacing = 'md',
  className,
  children,
}: DividerProps): ReactNode {
  if (children) {
    return (
      <div
        className={clsx(
          styles.dividerWithText,
          styles[`divider--${orientation}`],
          styles[`divider--spacing-${spacing}`],
          className
        )}
      >
        <div className={clsx(styles.dividerLine, styles[`divider--${variant}`])} />
        <span className={styles.dividerText}>{children}</span>
        <div className={clsx(styles.dividerLine, styles[`divider--${variant}`])} />
      </div>
    );
  }

  return (
    <hr
      className={clsx(
        styles.divider,
        styles[`divider--${variant}`],
        styles[`divider--${orientation}`],
        styles[`divider--spacing-${spacing}`],
        className
      )}
    />
  );
}

