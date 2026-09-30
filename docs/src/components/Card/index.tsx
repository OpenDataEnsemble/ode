import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import styles from './styles.module.css';

interface CardProps {
  title: string;
  subtitle?: string;
  link?: string;
  href?: string;
  icon?: string;
  children?: ReactNode;
  className?: string;
}

export default function Card({
  title,
  subtitle,
  link,
  href,
  icon,
  children,
  className,
}: CardProps): ReactNode {
  const content = (
    <div className={clsx(styles.card, className)}>
      {icon && (
        <div className={styles.cardIcon}>
          <span className={styles.icon}>{icon}</span>
        </div>
      )}
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
        {children && <div className={styles.cardDescription}>{children}</div>}
      </div>
    </div>
  );

  if (link || href) {
    let to: string;
    if (href) {
      to = href;
    } else if (link) {
      to = link.startsWith('/') ? link : link;
    } else {
      to = '#';
    }
    
    return (
      <Link to={to} className={styles.cardLink}>
        {content}
      </Link>
    );
  }

  return content;
}

