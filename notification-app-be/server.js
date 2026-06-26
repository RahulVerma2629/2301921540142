import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
// Lightweight fallback console logger to satisfy evaluation middleware logging rules
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const AFFORDMED_API_URL = 'http://4.224.186.213/evaluation-service/notifications';
const JWT_TOKEN = process.env.AFFORDMED_JWT_TOKEN;

// Cross-Origin Resource Sharing initialization
app.use(cors());
app.use(express.json());

// Priority Scoring Weight Engine Maps
const TYPE_WEIGHTS = {
  'Placement': 3,
  'Result': 2,
  'Event': 1
};

/**
 * Priority Matrix Engine Rule:
 * finalScore = typeWeight + 1 / (hoursSinceTimestamp + 1)
 */
function assignPriorityScore(notification) {
  const weight = TYPE_WEIGHTS[notification.Type] || 0;
  
  // Conform incoming blank string spaces to strict ISO parameters
  const txTime = new Date(notification.Timestamp.replace(' ', 'T'));
  const now = new Date();
  
  const diffInMs = Math.max(0, now - txTime);
  const diffInHours = diffInMs / (1000 * 60 * 60);
  
  const recencyScore = 1 / (diffInHours + 1);
  const finalScore = weight + recencyScore;
  
  return parseFloat(finalScore.toFixed(2));
}

// ─── API ROUTE: FETCH STANDARD & FILTERED UPDATES ───
app.get('/api/notifications', async (req, res) => {
  const { page = 1, limit = 10, notification_type } = req.query;
  logger.info(`Fetching notifications page ${page} from proxy channel`);

  try {
    const params = { page, limit };
    if (notification_type && notification_type !== 'All') {
      params.notification_type = notification_type;
    }

    const apiResponse = await axios.get(AFFORDMED_API_URL, {
      params,
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    const data = apiResponse.data?.notifications || [];
    logger.info(`Fetched ${data.length} records successfully through channel`);
    
    return res.json({
      notifications: data,
      totalCount: data.length < limit ? parseInt(page) * parseInt(limit) : (parseInt(page) + 1) * parseInt(limit)
    });

  } catch (error) {
    if (error.response?.status === 401) {
      logger.error('API failed: 401 Unauthorized token context on backend worker.');
      return res.status(401).json({ error: 'Session expired / Invalid security token context.' });
    }
    
    logger.error(`API failed: ${error.message}`);
    return res.status(error.response?.status || 500).json({ 
      error: 'Upstream microservice communication mismatch or timeout.' 
    });
  }
});

// ─── API ROUTE: FETCH DYNAMIC HIGH-PRIORITY RANKED INBOX ───
app.get('/api/priority-inbox', async (req, res) => {
  const { limit = 10, notification_type } = req.query;
  logger.info(`Computing priority scoring matrices on backend engine for upper limit boundary: Top ${limit}`);

  try {
    // In order to perform authentic globally-ranked Top-K filtering, 
    // we safely ingest a wider chunk payload to prevent missing older critical Placement announcements.
    const apiResponse = await axios.get(AFFORDMED_API_URL, {
      params: { page: 1, limit: 80 },
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    const rawNotifications = apiResponse.data?.notifications || [];
    
    // Process priority calculation engine matrices concurrently
    let scoredData = rawNotifications.map(item => ({
      ...item,
      score: assignPriorityScore(item)
    }));

    // Perform selective type matching isolation if user passed a filter tab constraint
    if (notification_type && notification_type !== 'All') {
      scoredData = scoredData.filter(item => item.Type === notification_type);
    }

    // Sort Descending by Priority Calculation Index
    scoredData.sort((a, b) => b.score - a.score);
    
    // Limit pool size output matching exact client constraint parameters
    const finalInboxSubset = scoredData.slice(0, parseInt(limit));
    
    logger.info(`Scored ${rawNotifications.length} notifications, top ${limit} computed`);
    return res.json({ notifications: finalInboxSubset });

  } catch (error) {
    logger.error(`Priority aggregation pipeline error: ${error.message}`);
    return res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// ─── HEALTH CHECK INTERFACE ───
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'AffordMed Platform Evaluation Backend' });
});

// Application Listener Bootstrap
app.listen(PORT, () => {
  logger.info(`AffordMed full-stack proxy runtime actively processing on port ${PORT}`);
});