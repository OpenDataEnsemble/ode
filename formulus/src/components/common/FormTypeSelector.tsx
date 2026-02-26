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
import colors from '../../theme/colors';
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
  const { themeColors } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find(opt => opt.id === selectedId);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.selector,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.divider,
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
          style={[styles.selectorText, { color: themeColors.onSurface }]}>
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
          style={[styles.modalOverlay, { backgroundColor: colors.ui.background }]}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: themeColors.surface,
                shadowColor: themeColors.surface,
              },
            ]}>
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: themeColors.divider },
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
              data={[{ id: null, name: placeholder }, ...options]}
              keyExtractor={item => item.id || 'all'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    { borderBottomColor: themeColors.divider },
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
                      { color: themeColors.onSurface },
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
  modalContent: {
    borderRadius: 12,
    width: '80%',
    maxWidth: 400,
    maxHeight: '70%',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
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
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
});

export default FormTypeSelector;
