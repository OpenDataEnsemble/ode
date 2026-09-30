import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

interface ContainerProps {
  size?: ContainerSize;
  children: ReactNode;
  className?: string;
}

export default function Container({
  size = 'lg',
  children,
  className,
}: ContainerProps): ReactNode {
  return (
    <div
      className={clsx(
        styles.container,
        styles[`container--${size}`],
        className
      )}
    >
      {children}
    </div>
  );
}
