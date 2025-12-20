import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import colors from '../../theme/colors';

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
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find(opt => opt.id === selectedId);

  return (
    <>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}>
        <Icon
          name="file-document-outline"
          size={18}
          color={colors.neutral[600]}
        />
        <Text style={styles.selectorText}>
          {selectedOption ? selectedOption.name : placeholder}
        </Text>
        <Icon name="chevron-down" size={20} color={colors.neutral[600]} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Form Type</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[{id: null, name: placeholder}, ...options]}
              keyExtractor={item => item.id || 'all'}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    selectedId === item.id && styles.optionItemSelected,
                  ]}
                  onPress={() => {
                    onSelect(item.id);
                    setModalVisible(false);
                  }}>
                  <Text
                    style={[
                      styles.optionText,
                      selectedId === item.id && styles.optionTextSelected,
                    ]}>
                    {item.name}
                  </Text>
                  {selectedId === item.id && (
                    <Icon
                      name="check"
                      size={20}
                      color={colors.brand.primary[500]}
                    />
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
    backgroundColor: colors.neutral.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: 8,
    flex: 1,
    maxWidth: 300,
    alignSelf: 'center',
  },
  selectorText: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral[900],
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    width: '80%',
    maxWidth: 400,
    maxHeight: '70%',
    shadowColor: colors.neutral.black,
    shadowOffset: {width: 0, height: 2},
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
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  optionItemSelected: {
    backgroundColor: colors.brand.primary[50],
  },
  optionText: {
    fontSize: 16,
    color: colors.neutral[900],
  },
  optionTextSelected: {
    color: colors.brand.primary[500],
    fontWeight: '600',
  },
});

export default FormTypeSelector;
