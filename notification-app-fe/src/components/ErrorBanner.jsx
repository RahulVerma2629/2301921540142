import React from 'react';
import { Alert, Button, Box, Typography } from '@mui/material';

export default function ErrorBanner({ error, onRetry }) {
  const is401 = error?.response?.status === 401;

  return (
    <Box sx={{ my: 3, width: '100%' }}>
      <Alert 
        severity="error" 
        action={
          !is401 && onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              RETRY
            </Button>
          )
        }
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          {is401 
            ? "Session expired: 401 Unauthorized Access. Please update or confirm your application JWT credentials." 
            : `System Error: ${error.message || "Network request failed to process."}`
          }
        </Typography>
      </Alert>
    </Box>
  );
}