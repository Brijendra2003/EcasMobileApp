import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Bottom sheet on a plain Modal (no gesture library, minimal animation). */
export function Sheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Pressable accessibilityLabel="Close" className="flex-1 bg-black/40" onPress={onClose} />
        <View className="max-h-[85%] rounded-t-xl bg-surface" style={{ paddingBottom: insets.bottom + 12 }}>
          <View className="items-center pt-2">
            <View className="h-1 w-10 rounded-full bg-line" />
          </View>
          {title ? (
            <Text variant="heading" className="px-4 pb-2 pt-3">
              {title}
            </Text>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-2">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
