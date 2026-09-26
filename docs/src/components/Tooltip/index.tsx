import type { ReactNode } from 'react';
import { useState } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  position?: TooltipPosition;
  children: ReactNode;
  className?: string;
  delay?: number;
}

export default function Tooltip({
  content,
  position = 'top',
  children,
  className,
  delay = 200,
}: TooltipProps): ReactNode {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  return (
    <div
      className={clsx(styles.tooltipWrapper, className)}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={clsx(
            styles.tooltip,
            styles[`tooltip--${position}`]
          )}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}
