import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import colors from '../../theme/colors';

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

const StatusTabs: React.FC<StatusTabsProps> = ({tabs, activeTab, onTabChange}) => {
  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.id)}
            activeOpacity={0.7}
          >
            {tab.icon && (
              <View
                style={[
                  styles.dot,
                  {backgroundColor: tab.iconColor || '#999'},
                ]}
              />
            )}
            <Text
              style={[styles.tabLabel, isActive && styles.tabLabelActive]}
            >
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
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.brand.primary[500],
  },
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
  tabLabelActive: {
    color: colors.brand.primary[500],
    fontWeight: '600',
  },
});

export default StatusTabs;

