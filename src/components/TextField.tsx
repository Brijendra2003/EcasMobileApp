import { forwardRef, type ComponentRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from './theme';
import { Text } from './Text';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

// eslint-disable-next-line @typescript-eslint/no-shadow -- named for React DevTools
export const TextField = forwardRef<ComponentRef<typeof TextInput>, Props>(function TextField({ label, error, hint, multiline, ...rest }, ref) {
  const { colors } = useTheme();
  return (
    <View className="mb-4">
      <Text variant="label" className="mb-1">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        className={`${multiline ? 'min-h-24 py-3' : 'min-h-12'} rounded-md border bg-surface px-3 text-base text-ink ${error ? 'border-danger' : 'border-line'}`}
        {...rest}
      />
      {error ? (
        <Text className="mt-1 text-sm text-danger">{error}</Text>
      ) : hint ? (
        <Text variant="caption" className="mt-1">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
