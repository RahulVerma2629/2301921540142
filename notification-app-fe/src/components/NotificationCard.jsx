import React from 'react';
import { Card, CardContent, Typography, Box, Badge, Chip } from '@mui/material';

const CHIP_COLORS = {
  Placement: 'primary',
  Result: 'success',
  Event: 'warning'
};

export default function NotificationCard({ item, isRead, onMarkRead }) {
  return (
    <Card 
      onClick={() => !isRead && onMarkRead(item.ID)}
      sx={{ 
        mb: 2, 
        cursor: isRead ? 'default' : 'pointer',
        borderLeft: isRead ? 'none' : '5px solid #1976d2',
        backgroundColor: isRead ? '#fcfcfc' : '#ffffff',
        boxShadow: isRead ? 0 : 2,
        border: isRead ? '1px solid #e0e0e0' : 'none',
        transition: 'all 0.2s ease-in-out',
        '&:hover': { 
          boxShadow: isRead ? 0 : 4 
        }
      }}
    >
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge color="error" variant="dot" invisible={isRead} sx={{ '& .MuiBadge-badge': { right: -6, top: 4 } }}>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: isRead ? 500 : 700, 
                  color: isRead ? 'text.secondary' : 'text.primary' 
                }}
              >
                {item.Type} Notice
              </Typography>
            </Badge>
          </Box>
          <Chip 
            label={item.Type} 
            size="small" 
            color={CHIP_COLORS[item.Type] || 'default'} 
            variant={isRead ? 'outlined' : 'filled'}
          />
        </Box>
        
        <Typography 
          variant="body1" 
          sx={{ 
            my: 1, 
            color: isRead ? 'text.secondary' : 'text.primary',
            fontWeight: isRead ? 400 : 500 
          }}
        >
          {item.Message}
        </Typography>

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Sent: {item.Timestamp}
        </Typography>
      </CardContent>
    </Card>
  );
}