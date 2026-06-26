import React from 'react';
import { Box, Tabs, Tab, FormControl, InputLabel, Select, MenuItem, useTheme, useMediaQuery } from '@mui/material';

export default function FilterBar({ currentType, onTypeChange }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const categories = ['All', 'Placement', 'Result', 'Event'];

  if (isMobile) {
    return (
      <Box sx={{ mb: 3, width: '100%' }}>
        <FormControl fullWidth size="small">
          <InputLabel id="category-filter-label">Filter Category</InputLabel>
          <Select
            labelId="category-filter-label"
            value={currentType}
            label="Filter Category"
            onChange={(e) => onTypeChange(e.target.value)}
          >
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    );
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs 
        value={currentType} 
        onChange={(e, val) => onTypeChange(val)} 
        textColor="primary"
        indicatorColor="primary"
      >
        {categories.map((cat) => (
          <Tab key={cat} label={cat} value={cat} sx={{ fontWeight: 'bold' }} />
        ))}
      </Tabs>
    </Box>
  );
}