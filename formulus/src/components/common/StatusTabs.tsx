import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import { useAppTheme } from '../../contexts/AppThemeContext';

export interface StatusTab {
  id: string;
  label: string;
  icon?: string;
  iconColor?: string;
}

interface StatusTabsProps {
  tabs: StatusTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const StatusTabs: React.FC<StatusTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  const { themeColors } = useAppTheme();

  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              isActive && {
                borderBottomWidth: 2,
                borderBottomColor: themeColors.primary,
              },
            ]}
            onPress={() => onTabChange(tab.id)}
            activeOpacity={0.7}>
            {tab.icon && (
              <View
                style={[
                  styles.dot,
                  { backgroundColor: tab.iconColor || colors.neutral[500] },
                ]}
              />
            )}
            <Text
              style={[
                styles.tabLabel,
                isActive && { color: themeColors.primary, fontWeight: '600' },
              ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    paddingVertical: 4,
  },
  // tabActive styles are now applied inline via themeColors.primary
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  tabLabel: {
    fontSize: 14,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  // tabLabelActive styles are now applied inline via themeColors.primary
});

export default StatusTabs;
