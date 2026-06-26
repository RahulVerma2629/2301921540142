import React from 'react';
import { Box, Skeleton, Card, CardContent } from '@mui/material';

export default function LoadingSkeleton() {
  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      {[1, 2, 3].map((index) => (
        <Card key={index} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
              <Skeleton variant="text" width="20%" height={25} />
              <Skeleton variant="rectangular" width={60} height={20} />
            </Box>
            <Skeleton variant="rectangular" width="100%" height={45} sx={{ my: 1.5 }} />
            <Skeleton variant="text" width="15%" height={20} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}