import { Text as RNText, type TextProps } from 'react-native';

type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'muted' | 'caption' | 'label';

const VARIANTS: Record<Variant, string> = {
  title: 'text-2xl font-bold text-ink',
  heading: 'text-lg font-semibold text-ink',
  subheading: 'text-base font-semibold text-ink',
  body: 'text-base text-ink',
  muted: 'text-sm text-muted',
  caption: 'text-xs text-muted',
  label: 'text-sm font-medium text-ink',
};

export function Text({ variant = 'body', className, ...rest }: TextProps & { variant?: Variant; className?: string }) {
  return <RNText className={`${VARIANTS[variant]} ${className ?? ''}`} {...rest} />;
}
