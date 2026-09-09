import styles from './index.module.css';

export interface PageStateProps {
  code?: string;
  title: string;
  description: string;
  actionText: string;
  onAction: () => void;
  role?: 'alert' | 'status';
}

/** Shared presentation only; navigation and recovery belong to the application. */
export function PageState({
  code,
  title,
  description,
  actionText,
  onAction,
  role,
}: PageStateProps) {
  return (
    <main class={styles.page} role={role}>
      <section class={styles.content}>
        <div class={styles.illustration} aria-hidden="true">
          {code ? (
            <span class={styles.code}>{code}</span>
          ) : (
            <svg viewBox="0 0 80 80" fill="none" focusable="false">
              <path
                d="M23 12h23l12 12v42H23a5 5 0 0 1-5-5V17a5 5 0 0 1 5-5Z"
                class={styles.paper}
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
              />
              <path
                d="M46 12v14h12M29 36h17M29 44h10"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="57" cy="58" r="15" class={styles.badge} />
              <path
                d="M57 50v9"
                class={styles.mark}
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <circle cx="57" cy="64" r="1.5" class={styles.dot} />
            </svg>
          )}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        <button class={styles.action} type="button" onClick={onAction}>
          {actionText}
        </button>
      </section>
    </main>
  );
}
