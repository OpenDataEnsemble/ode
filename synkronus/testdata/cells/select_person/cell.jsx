import React, { useState } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const SelectPersonCell = ({
  value,
  onChange,
  required,
  disabled,
  label = 'Select Person',
  ...props
}) => {
  const [selectedValue, setSelectedValue] = useState(value || '');

  const handleChange = (event) => {
    const newValue = event.target.value;
    setSelectedValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  const people = [
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
    { id: '3', name: 'Bob Johnson' }
  ];

  return (
    <FormControl fullWidth variant="outlined" size="small" disabled={disabled}>
      <InputLabel id="select-person-label">{label}</InputLabel>
      <Select
        labelId="select-person-label"
        id="select-person"
        value={selectedValue}
        onChange={handleChange}
        label={label}
        required={required}
        displayEmpty
        {...props}
      >
        <MenuItem value="">
          <em>Select a person</em>
        </MenuItem>
        {people.map((person) => (
          <MenuItem key={person.id} value={person.id}>
            {person.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default SelectPersonCell;