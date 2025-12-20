import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {FormSpec} from '../../services/FormService';
import colors from '../../theme/colors';

interface FormCardProps {
  form: FormSpec;
  observationCount?: number;
  onPress: () => void;
}

const FormCard: React.FC<FormCardProps> = ({
  form,
  observationCount = 0,
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon
            name="file-document-outline"
            size={32}
            color={colors.brand.primary[500]}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.name}>{form.name}</Text>
          {form.description && (
            <Text style={styles.description} numberOfLines={2}>
              {form.description}
            </Text>
          )}
          <View style={styles.metaContainer}>
            <Text style={styles.version}>v{form.schemaVersion}</Text>
            {observationCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {observationCount}{' '}
                  {observationCount === 1 ? 'entry' : 'entries'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Icon name="chevron-right" size={24} color={colors.neutral[500]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    shadowColor: colors.neutral.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.neutral[600],
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  version: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  countBadge: {
    backgroundColor: colors.brand.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    color: colors.brand.primary[500],
    fontWeight: '500',
  },
});

export default FormCard;
