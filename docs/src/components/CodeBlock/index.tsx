import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

interface CodeBlockProps {
  children: ReactNode;
  language?: string;
  title?: string;
  className?: string;
  showLineNumbers?: boolean;
}

export default function CodeBlock({
  children,
  language,
  title,
  className,
  showLineNumbers = false,
}: CodeBlockProps): ReactNode {
  return (
    <div className={clsx(styles.codeBlockWrapper, className)}>
      {title && (
        <div className={styles.codeBlockHeader}>
          {language && (
            <span className={styles.codeBlockLanguage}>{language}</span>
          )}
          <span className={styles.codeBlockTitle}>{title}</span>
        </div>
      )}
      <div className={styles.codeBlockContainer}>
        <pre
          className={clsx(
            styles.codeBlock,
            showLineNumbers && styles['codeBlock--lineNumbers']
          )}
        >
          <code className={language ? `language-${language}` : undefined}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}
