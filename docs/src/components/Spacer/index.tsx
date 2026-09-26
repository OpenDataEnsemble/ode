import type { ReactElement } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type SpacerSize = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;
type SpacerAxis = 'x' | 'y' | 'both';

interface SpacerProps {
  size: SpacerSize;
  axis?: SpacerAxis;
  className?: string;
}

export default function Spacer({
  size,
  axis = 'both',
  className,
}: SpacerProps): React.ReactElement {
  return (
    <div
      className={clsx(
        styles.spacer,
        styles[`spacer--${axis}`],
        styles[`spacer--${size}`],
        className
      )}
      aria-hidden="true"
    />
  );
}

