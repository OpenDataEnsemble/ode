import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { SortOption, FilterOption } from './FilterBar.types';
import { colors } from '../../theme/colors';
import Input from './Input';
import Button from './Button';

export type { SortOption, FilterOption };

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  filterOption?: FilterOption;
  onFilterChange?: (option: FilterOption) => void;
  showFilter?: boolean;
}

const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  filterOption = 'all',
  onFilterChange,
  showFilter = false,
}) => {
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'date-desc', label: 'Newest' },
    { value: 'date-asc', label: 'Oldest' },
    { value: 'form-type', label: 'Form Type' },
    { value: 'sync-status', label: 'Sync Status' },
  ];

  const filterOptions: { value: FilterOption; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'synced', label: 'Synced' },
    { value: 'pending', label: 'Pending' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon
          name="magnify"
          size={20}
          color={colors.neutral[500]}
          style={styles.searchIcon}
        />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChangeText={onSearchChange}
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8}>
            <Icon name="close-circle" size={20} color={colors.neutral[500]} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.sortContainer}>
          <Text style={styles.label}>Sort:</Text>
          {sortOptions.map(option => (
            <Button
              key={option.value}
              title={option.label}
              onPress={() => onSortChange(option.value)}
              variant={sortOption === option.value ? 'primary' : 'tertiary'}
              size="small"
              style={styles.optionButton}
            />
          ))}
        </View>

        {showFilter && onFilterChange && (
          <View style={styles.filterContainer}>
            <Text style={styles.label}>Filter:</Text>
            {filterOptions.map(option => (
              <Button
                key={option.value}
                title={option.label}
                onPress={() => onFilterChange(option.value)}
                variant={filterOption === option.value ? 'primary' : 'tertiary'}
                size="small"
                style={styles.optionButton}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.white,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.gray.light,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: colors.neutral[600],
    marginRight: 8,
    fontWeight: '500',
  },
  optionButton: {
    marginRight: 6,
    marginBottom: 4,
  },
});

export default FilterBar;
