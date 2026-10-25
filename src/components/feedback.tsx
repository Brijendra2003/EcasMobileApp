import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../lib/errors';
import { Button } from './Button';
import { Text } from './Text';

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View className="items-center px-8 py-12">
      <Text variant="subheading" className="text-center">
        {title}
      </Text>
      {body ? (
        <Text variant="muted" className="mt-1 text-center">
          {body}
        </Text>
      ) : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View className="items-center py-12" accessibilityLabel={label ?? t('common.loading')}>
      <ActivityIndicator />
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={errorMessage(error)}
      action={onRetry ? <Button variant="secondary" title={t('common.retry')} onPress={onRetry} /> : undefined}
    />
  );
}

/** Renders loading / error / empty / content for a query in one place. */
export function QueryView<T>({
  query,
  empty,
  children,
}: {
  query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  empty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (query.data === undefined) {
    if (query.isPending && !query.error) {
      return <LoadingState />;
    }
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }
  if (empty?.(query.data)) {
    return <EmptyState title={t('common.nothingHere')} />;
  }
  return <>{children(query.data)}</>;
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger' | 'safe'; children: ReactNode }) {
  const cls = {
    info: 'bg-primary/10 border-primary/30',
    warn: 'bg-warn/10 border-warn/40',
    danger: 'bg-danger/10 border-danger/40',
    safe: 'bg-safe/10 border-safe/40',
  }[tone];
  return <View className={`rounded-md border px-3 py-2 ${cls}`}>{typeof children === 'string' ? <Text variant="label">{children}</Text> : children}</View>;
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View className="mb-2 mt-5 flex-row items-center justify-between">
      <Text variant="caption" className="font-semibold uppercase tracking-wider">
        {children}
      </Text>
      {right}
    </View>
  );
}
