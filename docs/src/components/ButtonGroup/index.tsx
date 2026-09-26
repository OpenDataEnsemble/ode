import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

interface ButtonGroupProps {
  children: ReactNode;
  className?: string;
}

export default function ButtonGroup({
  children,
  className,
}: ButtonGroupProps): ReactNode {
  return (
    <div className={clsx(styles.buttonGroup, className)}>
      {children}
    </div>
  );
}
