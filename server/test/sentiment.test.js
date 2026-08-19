const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeTitle, calculateStatistics } = require('../src/sentiment');
const { normalizeSubreddit } = require('../src/reddit');

test('classifies title sentiment and calculates summary percentages', () => {
  const posts = ['great news', 'ordinary update', 'this is terrible'].map((title) => ({
    sentiment: analyzeTitle(title)
  }));
  const statistics = calculateStatistics(posts);

  assert.deepEqual(posts.map((post) => post.sentiment.label), ['positive', 'neutral', 'negative']);
  assert.equal(statistics.totalPosts, 3);
  assert.equal(statistics.positive.percentage, 33.3);
  assert.equal(statistics.neutral.percentage, 33.3);
  assert.equal(statistics.negative.percentage, 33.3);
});

test('accepts subreddit prefixes and rejects invalid names', () => {
  assert.equal(normalizeSubreddit(' r/technology '), 'technology');
  assert.equal(normalizeSubreddit('https://www.reddit.com/r/reactjs/'), 'reactjs');
  assert.equal(normalizeSubreddit('javascript'), 'javascript');
  assert.equal(normalizeSubreddit('webdev'), 'webdev');
  assert.equal(normalizeSubreddit('news'), 'news');
  assert.equal(normalizeSubreddit('gaming'), 'gaming');
  assert.equal(normalizeSubreddit('python'), 'python');
  assert.throws(() => normalizeSubreddit('a!'), { code: 'INVALID_SUBREDDIT' });
});
