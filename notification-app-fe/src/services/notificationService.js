import axios from 'axios';
import logger from '../middleware/logger.js';

const API_URL = 'http://4.224.186.213/evaluation-service/notifications';
// Fallback to placeholder if token isn't provided globally
const JWT_TOKEN = import.meta.env.VITE_AFFORDMED_JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';

export const fetchNotifications = async (page = 1, limit = 10, type = 'All') => {
  logger.info(`Fetching notifications page ${page}`);
  
  try {
    const params = { page, limit };
    if (type !== 'All') {
      params.notification_type = type;
    }

    const response = await axios.get(API_URL, {
      params,
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });

    const data = response.data?.notifications || [];
    logger.info(`Fetched ${data.length} notifications`);
    
    return {
      notifications: data,
      // The evaluation API might not provide headers for total count. 
      // We set a logical pagination boundary for UI demonstration purposes.
      totalCount: data.length < limit ? page * limit : (page + 1) * limit
    };
  } catch (error) {
    logger.error("API failed: " + error.message);
    throw error;
  }
};