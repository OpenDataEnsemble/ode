import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

interface CardsProps {
  children: ReactNode;
  className?: string;
}

export default function Cards({ children, className }: CardsProps): ReactNode {
  return (
    <div className={clsx(styles.cards, className)}>
      {children}
    </div>
  );
}

