import React from 'react';
import { Card, CardContent, Typography, Box, Avatar, Chip } from '@mui/material';

const TYPE_COLORS = { Placement: '#1976d2', Result: '#2e7d32', Event: '#ed6c02' };

const RANK_ACCENTS = {
  1: '#ffd700', // Gold
  2: '#c0c0c0', // Silver
  3: '#cd7f32'  // Bronze
};

export default function PriorityCard({ item, rank }) {
  const leftAccentColor = RANK_ACCENTS[rank] || 'transparent';

  return (
    <Card 
      sx={{ 
        mb: 2, 
        borderLeft: leftAccentColor !== 'transparent' ? `6px solid ${leftAccentColor}` : '1px solid #e0e0e0',
        boxShadow: rank <= 3 ? 3 : 1,
        transition: 'transform 0.15s ease',
        '&:hover': { transform: 'scale(1.01)' }
      }}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
        <Avatar 
          sx={{ 
            bgcolor: leftAccentColor !== 'transparent' ? leftAccentColor : '#757575', 
            color: '#fff', 
            fontWeight: 'bold',
            boxShadow: leftAccentColor !== 'transparent' ? 1 : 0
          }}
        >
          {rank}
        </Avatar>

        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            <Chip 
              label={item.Type} 
              size="small" 
              sx={{ backgroundColor: TYPE_COLORS[item.Type] || '#757575', color: '#fff', fontWeight: 'bold' }} 
            />
            <Chip 
              label={`Priority Score: ${item.score}`} 
              size="small" 
              variant="outlined" 
              color="secondary" 
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
          
          <Typography 
            variant="body1" 
            sx={{ fontWeight: rank <= 3 ? 600 : 400, color: 'text.primary', my: 0.5 }}
          >
            {item.Message}
          </Typography>
          
          <Typography variant="caption" color="text.secondary">
            Timestamp: {item.Timestamp}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}