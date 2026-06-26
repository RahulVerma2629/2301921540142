import React from 'react';
import { Box, Pagination } from '@mui/material';

export default function PaginationBar({ page, count, onChange }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 4 }}>
      <Pagination 
        count={count} 
        page={page} 
        onChange={(e, p) => onChange(p)} 
        color="primary" 
        shape="rounded" 
        size="medium"
      />
    </Box>
  );
}