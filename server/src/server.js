require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { fetchHotPosts } = require('./reddit');
const { analyzeTitle, calculateStatistics } = require('./sentiment');
const { ApiError } = require('./errors');

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim())
  : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'subreddit-vibe-check-api' });
});

app.get('/api/subreddit/:subreddit', async (req, res, next) => {
  try {
    const { name, posts: rawPosts } = await fetchHotPosts(req.params.subreddit);
    const posts = rawPosts.map((post) => ({ ...post, sentiment: analyzeTitle(post.title) }));
    const statistics = calculateStatistics(posts);

    res.json({
      subreddit: { name, displayName: `r/${name}` },
      statistics,
      posts,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')));

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: { code: error.code || 'INTERNAL_ERROR', message: error.message || 'Something went wrong. Please try again.' }
  });
});

app.listen(port, () => console.log(`Subreddit Vibe Check API listening on port ${port}`));
