import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../contexts/AppThemeContext';
import colors from '../../theme/colors';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
} from '../../theme/odeDesign';
import {
  formatObservationIdShort,
  type ObservationListRow,
} from '../../database/observationListQuery';
import { isObservationFullySynced } from '../../utils/observationSyncStatus';
import { formatDateTimeShort } from '../../utils/dateUtils';

type ObservationListTableProps = {
  rows: ObservationListRow[];
  formNames: Record<string, string>;
  onPressRow: (row: ObservationListRow) => void;
};

type ObservationTableRowProps = {
  row: ObservationListRow;
  formLabel: string;
  onPressRow: (row: ObservationListRow) => void;
  cellColor: string;
  divider: string;
  pendingColor: string;
  syncedColor: string;
  syncedLabel: string;
  pendingLabel: string;
};

const ObservationTableRow = memo<ObservationTableRowProps>(
  ({
    row,
    formLabel,
    onPressRow,
    cellColor,
    divider,
    pendingColor,
    syncedColor,
    syncedLabel,
    pendingLabel,
  }) => {
    const synced = isObservationFullySynced(row);
    const onPress = useCallback(() => onPressRow(row), [onPressRow, row]);
    return (
      <Pressable
        onPress={onPress}
        style={[styles.row, { borderColor: divider }]}
        accessibilityRole="button">
        <Text style={[styles.cellForm, { color: cellColor }]} numberOfLines={1}>
          {formLabel}
        </Text>
        <Text style={[styles.cellWhen, { color: cellColor }]} numberOfLines={1}>
          {formatDateTimeShort(row.createdAt)}
        </Text>
        <Text
          style={[
            styles.cellSync,
            { color: synced ? syncedColor : pendingColor },
          ]}
          numberOfLines={1}>
          {synced ? syncedLabel : pendingLabel}
        </Text>
        <Text
          style={[styles.cellAuthor, { color: cellColor }]}
          numberOfLines={1}>
          {row.author || '—'}
        </Text>
        <Text
          style={[styles.cellId, styles.mono, { color: cellColor }]}
          numberOfLines={1}>
          {formatObservationIdShort(row.observationId)}
        </Text>
      </Pressable>
    );
  },
);

const ObservationListTable: React.FC<ObservationListTableProps> = ({
  rows,
  formNames,
  onPressRow,
}) => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const headerColor = themeColors.onSurface as string;
  const cellColor = themeColors.onSurface as string;
  const divider = themeColors.divider as string;
  const pendingColor = colors.semantic.warning[500] as string;
  const syncedColor = colors.brand.primary['500'] as string;
  const syncedLabel = t('filters.synced');
  const pendingLabel = t('filters.pending');

  return (
    <ScrollView
      style={styles.vScroll}
      contentContainerStyle={styles.vContent}
      keyboardShouldPersistTaps="handled">
      <View style={[styles.row, styles.headerRow, { borderColor: divider }]}>
        <Text style={[styles.cellForm, styles.header, { color: headerColor }]}>
          {t('observations.colForm')}
        </Text>
        <Text style={[styles.cellWhen, styles.header, { color: headerColor }]}>
          {t('observations.colCreated')}
        </Text>
        <Text style={[styles.cellSync, styles.header, { color: headerColor }]}>
          {t('observations.colSync')}
        </Text>
        <Text
          style={[styles.cellAuthor, styles.header, { color: headerColor }]}>
          {t('observations.colAuthor')}
        </Text>
        <Text style={[styles.cellId, styles.header, { color: headerColor }]}>
          {t('observations.colId')}
        </Text>
      </View>
      {rows.map(row => (
        <ObservationTableRow
          key={row.observationId}
          row={row}
          formLabel={formNames[row.formType] || row.formType}
          onPressRow={onPressRow}
          cellColor={cellColor}
          divider={divider}
          pendingColor={pendingColor}
          syncedColor={syncedColor}
          syncedLabel={syncedLabel}
          pendingLabel={pendingLabel}
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
    flex: 1.3,
    minWidth: 0,
    fontSize: odeTypography.bodySm,
    paddingRight: odeSpacing.xs,
  },
  cellWhen: {
    flex: 1.5,
    minWidth: 0,
    fontSize: odeTypography.bodySm,
    paddingRight: odeSpacing.xs,
  },
  cellSync: {
    flex: 0.7,
    minWidth: 0,
    fontSize: odeTypography.bodySm,
    paddingRight: odeSpacing.xs,
  },
  cellAuthor: {
    flex: 1,
    minWidth: 0,
    fontSize: odeTypography.bodySm,
    paddingRight: odeSpacing.xs,
  },
  cellId: {
    flex: 0.8,
    minWidth: 0,
    fontSize: odeTypography.bodySm,
  },
  mono: {
    fontFamily: 'monospace',
  },
});

export default ObservationListTable;
