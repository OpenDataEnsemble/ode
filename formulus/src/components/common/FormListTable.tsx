import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../contexts/AppThemeContext';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
} from '../../theme/odeDesign';
import type { FormSpec } from '../../services/FormService';

type FormListTableProps = {
  forms: FormSpec[];
  observationCounts: Record<string, number>;
  onCreate: (formId: string) => void;
};

type FormTableRowProps = {
  form: FormSpec;
  count: number | undefined;
  onCreate: (formId: string) => void;
  cellColor: string;
  divider: string;
  primary: string;
  newLabel: string;
};

const FormTableRow = memo<FormTableRowProps>(
  ({ form, count, onCreate, cellColor, divider, primary, newLabel }) => {
    const onPress = useCallback(() => onCreate(form.id), [onCreate, form.id]);
    return (
      <View style={[styles.row, { borderColor: divider }]}>
        <Text style={[styles.cellForm, { color: cellColor }]} numberOfLines={1}>
          {form.name || form.id}
        </Text>
        <Text
          style={[styles.cellCount, { color: cellColor }]}
          numberOfLines={1}>
          {count == null ? '—' : String(count)}
        </Text>
        <Pressable
          onPress={onPress}
          style={styles.cellNew}
          accessibilityRole="button"
          accessibilityLabel={newLabel}
          hitSlop={8}>
          <Icon name="plus-circle-outline" size={18} color={primary} />
        </Pressable>
      </View>
    );
  },
);

const FormListTable: React.FC<FormListTableProps> = ({
  forms,
  observationCounts,
  onCreate,
}) => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const headerColor = themeColors.onSurface as string;
  const cellColor = themeColors.onSurface as string;
  const divider = themeColors.divider as string;
  const primary = themeColors.primary as string;
  const newLabel = t('forms.colNewObservation');

  return (
    <ScrollView
      style={styles.vScroll}
      contentContainerStyle={styles.vContent}
      keyboardShouldPersistTaps="handled">
      <View style={[styles.row, styles.headerRow, { borderColor: divider }]}>
        <Text style={[styles.cellForm, styles.header, { color: headerColor }]}>
          {t('forms.colFormType')}
        </Text>
        <Text style={[styles.cellCount, styles.header, { color: headerColor }]}>
          {t('forms.colObservationCount')}
        </Text>
        <Text
          style={[
            styles.cellNew,
            styles.header,
            styles.newHeader,
            { color: headerColor },
          ]}
          numberOfLines={2}>
          {t('forms.colNewObservation')}
        </Text>
      </View>
      {forms.map(form => (
        <FormTableRow
          key={form.id}
          form={form}
          count={
            form.id in observationCounts
              ? observationCounts[form.id]
              : undefined
          }
          onCreate={onCreate}
          cellColor={cellColor}
          divider={divider}
          primary={primary}
          newLabel={newLabel}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  vScroll: {
    flex: 1,
  },
  vContent: {
    flexGrow: 1,
    paddingBottom: odeSpacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: odeBorderWidth.hairline,
    paddingVertical: odeSpacing.sm,
    paddingHorizontal: odeSpacing.sm,
  },
  headerRow: {
    paddingTop: odeSpacing.xs,
  },
  header: {
    fontWeight: '700',
    fontSize: odeTypography.caption,
  },
  cellForm: {
    flex: 1.4,
    minWidth: 0,
    fontSize: odeTypography.bodySm,
    paddingRight: odeSpacing.xs,
  },
  cellCount: {
    width: 216,
    fontSize: odeTypography.bodySm,
    paddingRight: odeSpacing.sm,
    textAlign: 'right',
  },
  cellNew: {
    width: 160,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  newHeader: {
    textAlign: 'right',
  },
});

export default FormListTable;
