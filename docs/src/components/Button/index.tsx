import type { ReactNode, ButtonHTMLAttributes } from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import styles from './styles.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'pill-light' | 'pill-dark';
type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

interface ButtonAsButton extends BaseButtonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  href?: never;
  to?: never;
  onClick?: () => void;
}

interface ButtonAsLink extends BaseButtonProps {
  href?: string;
  to?: string;
  onClick?: never;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className,
  disabled = false,
  href,
  to,
  onClick,
  ...props
}: ButtonProps): ReactNode {
  const classes = clsx(
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    disabled && styles['button--disabled'],
    className
  );

  if (href || to) {
    return (
      <Link
        to={href || to}
        className={classes}
        {...(props as any)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

