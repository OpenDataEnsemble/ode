import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, TextInput} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {SortOption, FilterOption} from './FilterBar.types';

export type {SortOption, FilterOption};

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
  const sortOptions: {value: SortOption; label: string}[] = [
    {value: 'date-desc', label: 'Newest'},
    {value: 'date-asc', label: 'Oldest'},
    {value: 'form-type', label: 'Form Type'},
    {value: 'sync-status', label: 'Sync Status'},
  ];

  const filterOptions: {value: FilterOption; label: string}[] = [
    {value: 'all', label: 'All'},
    {value: 'synced', label: 'Synced'},
    {value: 'pending', label: 'Pending'},
  ];

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Icon name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.controlsRow}>
        <View style={styles.sortContainer}>
          <Text style={styles.label}>Sort:</Text>
          {sortOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                sortOption === option.value && styles.optionButtonActive,
              ]}
              onPress={() => onSortChange(option.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  sortOption === option.value && styles.optionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {showFilter && onFilterChange && (
          <View style={styles.filterContainer}>
            <Text style={styles.label}>Filter:</Text>
            {filterOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  filterOption === option.value && styles.optionButtonActive,
                ]}
                onPress={() => onFilterChange(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    filterOption === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 8,
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
    color: '#666',
    marginRight: 8,
    fontWeight: '500',
  },
  optionButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginRight: 6,
    marginBottom: 4,
  },
  optionButtonActive: {
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
});

export default FilterBar;

