import React, { useState, useEffect } from 'react';
import { Container, Grid, Select, MenuItem, FormControl, InputLabel, Typography, Box } from '@mui/material';
import { fetchNotifications } from '../services/notificationService.js';
import { getPriorityInbox } from '../services/priorityService.js';
import PriorityCard from '../components/PriorityCard.jsx';
import FilterBar from '../components/FilterBar.jsx';
import LoadingSkeleton from '../components/LoadingSkeleton.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import logger from '../middleware/logger.js';

export default function PriorityInboxPage() {
  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topN, setTopN] = useState(10);
  const [type, setType] = useState('All');

  const loadAllForScoring = async () => {
    setLoading(true);
    setError(null);
    try {
      // Pulling large sample context array space to filter out accurate priority weights
      const res = await fetchNotifications(1, 80, 'All');
      setRawItems(res.notifications);
    } catch (err) {
      setError(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAllForScoring();
  }, []);

  const topScoredList = getPriorityInbox(rawItems, topN, type);

  useEffect(() => {
    if (rawItems.length > 0) {
      logger.info(`Scored ${rawItems.length} notifications, top ${topN} computed`);
    }
  }, [topN, type, rawItems]);

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Grid item xs={12} sm={8}>
          <FilterBar currentType={type} onTypeChange={setType} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel id="top-n-select-label">View Limit</InputLabel>
            <Select
              labelId="top-n-select-label"
              value={topN}
              label="View Limit"
              onChange={(e) => setTopN(e.target.value)}
            >
              {[5, 10, 15, 20].map(n => (
                <MenuItem key={n} value={n}>Top {n} Items</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {loading && <LoadingSkeleton />}
      
      {error && <ErrorBanner error={error} onRetry={loadAllForScoring} />}
      
      {!loading && !error && topScoredList.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No matching items found for priority ranking.
          </Typography>
        </Box>
      )}
      
      {!loading && !error && topScoredList.map((item, idx) => (
        <PriorityCard key={item.ID} item={item} rank={idx + 1} />
      ))}
    </Container>
  );
}