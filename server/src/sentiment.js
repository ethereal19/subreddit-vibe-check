const Sentiment = require('sentiment');

const analyzer = new Sentiment();

function classify(score) {
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

function analyzeTitle(title) {
  const result = analyzer.analyze(title || '');
  return { score: result.score, label: classify(result.score) };
}

function calculateStatistics(posts) {
  const totalPosts = posts.length;
  const counts = { positive: 0, neutral: 0, negative: 0 };
  const totalScore = posts.reduce((sum, post) => {
    counts[post.sentiment.label] += 1;
    return sum + post.sentiment.score;
  }, 0);

  const bucket = (label) => ({
    count: counts[label],
    percentage: totalPosts ? Number(((counts[label] / totalPosts) * 100).toFixed(1)) : 0
  });

  return {
    totalPosts,
    positive: bucket('positive'),
    neutral: bucket('neutral'),
    negative: bucket('negative'),
    averageSentiment: totalPosts ? Number((totalScore / totalPosts).toFixed(2)) : 0
  };
}

module.exports = { analyzeTitle, calculateStatistics };
