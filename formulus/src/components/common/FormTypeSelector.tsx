import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import colors, { withAlpha, CONTAINER_ALPHA } from '../../theme/colors';
import { useAppTheme } from '../../contexts/AppThemeContext';

interface FormTypeOption {
  id: string;
  name: string;
}

interface FormTypeSelectorProps {
  options: FormTypeOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  placeholder?: string;
}

const FormTypeSelector: React.FC<FormTypeSelectorProps> = ({
  options,
  selectedId,
  onSelect,
  placeholder = 'All Forms',
}) => {
  const { themeColors, resolvedMode } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const cardOuterBg = withAlpha(themeColors.surface as string, CONTAINER_ALPHA);
  const cardInnerBg = themeColors.surface as string;
  const isDark = resolvedMode === 'dark';
  const selectorTextColor = isDark
    ? (themeColors.onSurface as string)
    : (colors.neutral[900] as string);

  const optionsWithAll = [{ id: null, name: placeholder }, ...options];
  const selectedOption = options.find(opt => opt.id === selectedId);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.selector,
          {
            backgroundColor: withAlpha(themeColors.surface as string, CONTAINER_ALPHA),
            borderColor: themeColors.divider,
            borderWidth: 1,
          },
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}>
        <Icon
          name="file-document-outline"
          size={18}
          color={themeColors.onSurface}
        />
        <Text
          style={[styles.selectorText, { color: selectorTextColor }]}>
          {selectedOption ? selectedOption.name : placeholder}
        </Text>
        <Icon
          name="chevron-down"
          size={20}
          color={themeColors.onSurface}
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={[
            styles.modalOverlay,
            { backgroundColor: withAlpha(colors.neutral.black, 0.85) },
          ]}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}>
          <View
            style={[
              styles.modalContentOuter,
              {
                borderWidth: 1,
                borderColor: themeColors.divider as string,
                backgroundColor: cardOuterBg,
              },
            ]}>
            <View
              style={[styles.modalContentInner, { backgroundColor: cardInnerBg }]}>
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: themeColors.divider as string },
                ]}>
                <Text
                  style={[styles.modalTitle, { color: themeColors.onSurface }]}>
                  Select Form Type
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Icon
                    name="close"
                    size={24}
                    color={themeColors.onSurface}
                  />
                </TouchableOpacity>
              </View>

              <FlatList
                data={optionsWithAll}
                keyExtractor={item => item.id || 'all'}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      {
                        borderBottomColor: themeColors.divider,
                        borderBottomWidth:
                          index === optionsWithAll.length - 1 ? 0 : StyleSheet.hairlineWidth,
                      },
                      selectedId === item.id && {
                        backgroundColor: themeColors.primary + '14',
                      },
                    ]}
                    onPress={() => {
                      onSelect(item.id);
                      setModalVisible(false);
                    }}>
                    <Text
                      style={[
                        styles.optionText,
                        { color: selectorTextColor },
                        selectedId === item.id && {
                          color: themeColors.primary,
                          fontWeight: '600',
                        },
                      ]}>
                      {item.name}
                    </Text>
                    {selectedId === item.id && (
                      <Icon name="check" size={20} color={themeColors.primary} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    gap: 8,
    flex: 1,
    maxWidth: 300,
    alignSelf: 'center',
  },
  selectorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentOuter: {
    borderRadius: 12,
    padding: 16,
    width: '80%',
    maxWidth: 400,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalContentInner: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  optionText: {
    fontSize: 16,
  },
});

export default FormTypeSelector;
