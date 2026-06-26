export default function App() {
  return "Notifications App";
}import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Badge, Box } from '@mui/material';
import NotificationsPage from './pages/NotificationsPage.jsx';
import PriorityInboxPage from './pages/PriorityInboxPage.jsx';
import logger from './middleware/logger.js';

export default function App() {
  const [readStatus, setReadStatus] = useState({});
  const location = useLocation();

  useEffect(() => {
    logger.info(`User navigated to ${location.pathname}`);
  }, [location]);

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppBar position="sticky" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold', letterSpacing: 0.5 }}>
            Campus Notifications Portal
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button color="inherit" component={Link} to="/notifications" sx={{ fontWeight: 'bold' }}>
              All Notifications
            </Button>
            <Button color="inherit" component={Link} to="/priority" sx={{ fontWeight: 'bold' }}>
              Priority Inbox
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ py: 2 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/notifications" replace />} />
          <Route path="/notifications" element={<NotificationsPage readStatus={readStatus} setReadStatus={setReadStatus} />} />
          <Route path="/priority" element={<PriorityInboxPage />} />
        </Routes>
      </Box>
    </Box>
  );
}