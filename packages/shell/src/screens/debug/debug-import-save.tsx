// packages/shell/src/screens/debug/debug-import-save.tsx
import { StyleSheet, TextInput, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { useLocalizedTextStyle } from '@e07/shell/i18n/use-localized-text-style.ts';
import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { LAYOUT, RADII, SPACING, STROKE } from '@e07/shell/theme/tokens.ts';
import { typeStyleOf } from '@e07/shell/theme/type-styles.ts';
import { Button } from '@e07/shell/ui/button.tsx';
import { Toast } from '@e07/shell/ui/toast.tsx';

import type { ReactNode } from 'react';

/**
 * S15 "Import save from text": the paste field the Import save row opens (the design draws the row
 * without its field). e2e-maestro's use-debug-model.ts fills it.
 */
export type DebugImportField = {
  readonly isOpen: boolean;
  /** The pasted save document (the text "Export save as text" copies). */
  readonly text: string;
  /** Why the last import failed, as one sentence (English on purpose), or null. */
  readonly error: string | null;
  readonly onChangeText: (text: string) => void;
  /** Validates the text and writes it through the save service; closes the field when it worked. */
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
};

export type DebugImportSaveProps = {
  readonly field: DebugImportField;
  readonly isReducedMotion: boolean;
};

/** Room for a few lines of a pasted save document. */
const FIELD_MIN_HEIGHT = 120;

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    panel: { gap: LAYOUT.blockGap },
    field: {
      minHeight: FIELD_MIN_HEIGHT,
      padding: SPACING.md,
      borderWidth: STROKE.hair,
      borderRadius: RADII.sm,
      borderColor: theme.colors.text,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      textAlignVertical: 'top',
    },
  });
  return styles;
});

/** The open Import save field, its button, and the refusal as an alert toast (VoiceOver reads it). */
export function DebugImportSave({ field, isReducedMotion }: DebugImportSaveProps): ReactNode {
  const t = useT();
  const styles = useStyles();
  const body = typeStyleOf('body');
  const fieldText = useLocalizedTextStyle({
    fontSize: body.fontSize,
    weight: body.weight,
    face: body.face,
    lineHeight: body.lineHeight,
    align: 'start',
  });
  return (
    <View style={styles.panel}>
      <TextInput
        testID="debug.import-save-field"
        accessibilityLabel={t('debug.import-save')}
        value={field.text}
        onChangeText={field.onChangeText}
        style={[fieldText, styles.field]}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />
      <Button
        testID="debug.import-save-button"
        label={t('debug.import-save')}
        onPress={field.onSubmit}
        icon="back"
        isBlock
        isReducedMotion={isReducedMotion}
      />
      {field.error === null ? null : (
        <Toast
          testID="debug.import-save-error"
          text={field.error}
          icon="alert"
          delayMs={0}
          isReducedMotion={isReducedMotion}
        />
      )}
    </View>
  );
}
