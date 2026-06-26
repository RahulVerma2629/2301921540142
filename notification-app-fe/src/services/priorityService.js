const TYPE_WEIGHTS = {
  'Placement': 3,
  'Result': 2,
  'Event': 1
};

/**
 * Calculates the final priority score for a notification
 * finalScore = typeWeight + 1 / (hoursSinceTimestamp + 1)
 */
export const calculatePriorityScore = (notification) => {
  const weight = TYPE_WEIGHTS[notification.Type] || 0;
  
  // Parse standard string to date ("2026-04-22 17:51:30" -> ISO compliant format)
  const notificationTime = new Date(notification.Timestamp.replace(' ', 'T'));
  const currentTime = new Date();
  
  const diffInMs = Math.max(0, currentTime - notificationTime);
  const diffInHours = diffInMs / (1000 * 60 * 60);
  
  const recencyScore = 1 / (diffInHours + 1);
  const finalScore = weight + recencyScore;
  
  return parseFloat(finalScore.toFixed(2));
};

/**
 * Filter, sort, and slice notifications down to top N priority elements
 */
export const getPriorityInbox = (notifications, topN = 10, filterType = 'All') => {
  let processed = notifications.map(noti => ({
    ...noti,
    score: calculatePriorityScore(noti)
  }));

  if (filterType !== 'All') {
    processed = processed.filter(n => n.Type === filterType);
  }

  // Sort descending by final score
  return processed.sort((a, b) => b.score - a.score).slice(0, topN);
};