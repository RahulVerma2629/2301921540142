import React, { useState, useEffect } from 'react';
import { Container, Typography, Box } from '@mui/material';
import { fetchNotifications } from '../services/notificationService.js';
import NotificationCard from '../components/NotificationCard.jsx';
import FilterBar from '../components/FilterBar.jsx';
import PaginationBar from '../components/PaginationBar.jsx';
import LoadingSkeleton from '../components/LoadingSkeleton.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import logger from '../middleware/logger.js';

export default function NotificationsPage({ readStatus, setReadStatus }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('All');
  const [totalPages, setTotalPages] = useState(5); 
  const limit = 10;

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNotifications(page, limit, type);
      setNotifications(res.notifications);
      
      // Dynamic page bound calculator based on data filling bounds
      if (res.notifications.length < limit && page === 1) {
        setTotalPages(1);
      } else if (res.notifications.length < limit) {
        setTotalPages(page);
      } else {
        setTotalPages(page + 1);
      }
    } catch (err) {
      setError(err);
    } // Loader settles here
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, [page, type]);

  const handleMarkRead = (id) => {
    setReadStatus(prev => ({ ...prev, [id]: true }));
    logger.info(`Notification ID marked as read: ${id}`);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <FilterBar currentType={type} onTypeChange={(t) => { setType(t); setPage(1); }} />
      
      {loading && <LoadingSkeleton />}
      
      {error && <ErrorBanner error={error} onRetry={loadNotifications} />}
      
      {!loading && !error && notifications.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No notification records found matching criteria.
          </Typography>
        </Box>
      )}
      
      {!loading && !error && notifications.map(item => (
        <NotificationCard 
          key={item.ID} 
          item={item} 
          isRead={!!readStatus[item.ID]} 
          onMarkRead={handleMarkRead} 
        />
      ))}
      
      {!loading && !error && notifications.length > 0 && (
        <PaginationBar page={page} count={totalPages} onChange={setPage} />
      )}
    </Container>
  );
}