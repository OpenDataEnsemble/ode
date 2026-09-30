import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type TagVariant = 'primary' | 'secondary' | 'neutral';
type TagSize = 'sm' | 'md';

interface TagProps {
  variant?: TagVariant;
  size?: TagSize;
  children: ReactNode;
  className?: string;
  removable?: boolean;
  onRemove?: () => void;
}

export default function Tag({
  variant = 'neutral',
  size = 'md',
  children,
  className,
  removable = false,
  onRemove,
}: TagProps): ReactNode {
  return (
    <span
      className={clsx(
        styles.tag,
        styles[`tag--${variant}`],
        styles[`tag--${size}`],
        className
      )}
    >
      <span className={styles.tagContent}>{children}</span>
      {removable && (
        <button
          className={styles.tagRemove}
          onClick={onRemove}
          aria-label="Remove tag"
          type="button"
        >
          ×
        </button>
      )}
    </span>
  );
}

