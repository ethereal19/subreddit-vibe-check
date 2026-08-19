const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const { ApiError } = require('./errors');

const USER_AGENT = process.env.REDDIT_USER_AGENT || 'web:subreddit-vibe-check:1.0.0 (contact: local-development)';
// Browser-like UA for public RSS requests to avoid rate limiting
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SUPPORTED_SUBREDDITS = new Set([
  'technology',
  'reactjs',
  'programming',
  'javascript',
  'webdev',
  'news',
  'gaming',
]);
let tokenCache = { value: null, expiresAt: 0 };

// Simple in-memory cache: subreddit -> { data, expiresAt }
const postCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

function normalizeSubreddit(value) {
  const clean = decodeURIComponent(String(value || ''))
    .trim()
    .replace(/^https?:\/\/(?:www\.)?reddit\.com\/r\//i, '')
    .replace(/^\/?r\//i, '')
    .replace(/^\//, '')
    .replace(/\/$/, '');

  if (!/^[A-Za-z0-9_]{3,21}$/.test(clean)) {
    throw new ApiError(400, 'INVALID_SUBREDDIT', 'Enter a valid subreddit name (3–21 letters, numbers, or underscores).');
  }
  if (!SUPPORTED_SUBREDDITS.has(clean.toLowerCase())) {
    throw new ApiError(400, 'UNSUPPORTED_SUBREDDIT', 'Only technology, reactjs, and programming are supported.');
  }
  return clean;
}

async function getAccessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) return tokenCache.value;

  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET } = process.env;
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) return null;

  try {
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        auth: { username: REDDIT_CLIENT_ID, password: REDDIT_CLIENT_SECRET },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        timeout: 10000
      }
    );
    tokenCache = {
      value: response.data.access_token,
      expiresAt: Date.now() + Math.max((response.data.expires_in - 60) * 1000, 60000)
    };
    return tokenCache.value;
  } catch (error) {
    console.error('Reddit OAuth failed:', error.response?.status || error.message);
    // Don't throw — fall back to RSS
    return null;
  }
}

function toPost(item) {
  const data = item.data;
  const targetUrl = data.url_overridden_by_dest || data.url || `https://www.reddit.com${data.permalink}`;
  return {
    id: data.id,
    title: data.title || '[Untitled post]',
    author: data.author || '[deleted]',
    score: Number(data.score || 0),
    url: targetUrl,
    permalink: `https://www.reddit.com${data.permalink}`,
    createdAt: new Date(data.created_utc * 1000).toISOString(),
    comments: Number(data.num_comments || 0)
  };
}

// Extract score and comment count from RSS entry HTML content
function extractMetaFromHtml(html) {
  let score = 0;
  let comments = 0;
  if (!html) return { score, comments };

  // Reddit RSS embeds score/comment tables in some feeds
  const scoreMatch = html.match(/>(\d+)\s*(?:point|score)/i);
  if (scoreMatch) score = parseInt(scoreMatch[1], 10);

  const commentsMatch = html.match(/>(\d+)\s*comment/i);
  if (commentsMatch) comments = parseInt(commentsMatch[1], 10);

  return { score, comments };
}

function rssEntryToPost(entry) {
  const id = String(entry.id || '').replace(/^t3_/, '');
  const title = entry.title || '[Untitled post]';
  const authorName = entry.author?.name || '[deleted]';
  const author = authorName.replace(/^\/u\//, '');
  const permalink = entry.link?.['@_href'] || '';
  const createdAt = entry.published || entry.updated || new Date().toISOString();
  const content = entry.content?.['#text'] || entry.content || '';
  const { score, comments } = extractMetaFromHtml(content);

  return {
    id,
    title,
    author,
    score,
    url: permalink,
    permalink,
    createdAt: new Date(createdAt).toISOString(),
    comments,
  };
}

function mapRedditError(error) {
  if (error instanceof ApiError) throw error;
  const status = error.response?.status;
  if (status === 404) throw new ApiError(404, 'SUBREDDIT_NOT_FOUND', 'Subreddit not found. Check the name and try again.');
  if (status === 403) throw new ApiError(403, 'SUBREDDIT_UNAVAILABLE', 'This subreddit is private, quarantined, or unavailable.');
  if (status === 429) throw new ApiError(429, 'REDDIT_RATE_LIMIT', 'Reddit API rate limit reached. Please try again in a moment.');
  if (error.code === 'ECONNABORTED' || !error.response) throw new ApiError(503, 'REDDIT_UNAVAILABLE', 'Unable to reach Reddit right now. Please try again.');
  throw new ApiError(502, 'REDDIT_FETCH_FAILED', 'Unable to fetch Reddit data. Please try again.');
}

// Fetch via OAuth JSON API (when credentials are configured)
async function fetchOAuthPosts(name, token) {
  const response = await axios.get(`https://oauth.reddit.com/r/${encodeURIComponent(name)}/hot.json`, {
    params: { limit: 50, raw_json: 1 },
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      Authorization: `Bearer ${token}`,
    },
    timeout: 12000,
  });
  const children = response.data?.data?.children;
  if (!Array.isArray(children)) throw new Error('Unexpected Reddit response');
  return children.slice(0, 50).filter((item) => item.kind === 't3').map(toPost);
}

// Helper: wait ms
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch via public RSS feed with retry on 429
async function fetchRssPosts(name) {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(`https://www.reddit.com/r/${encodeURIComponent(name)}/hot.rss`, {
        params: { limit: 50 },
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15000,
        responseType: 'text',
      });

      const parsed = xmlParser.parse(response.data);
      const feed = parsed.feed;
      if (!feed) throw new Error('Unexpected RSS response');

      let entries = feed.entry;
      if (!entries) return [];
      if (!Array.isArray(entries)) entries = [entries];

      return entries.slice(0, 50).map(rssEntryToPost);
    } catch (err) {
      const status = err.response?.status;
      // Retry on 429 with exponential backoff
      if (status === 429 && attempt < maxRetries - 1) {
        const backoff = (attempt + 1) * 2000; // 2s, 4s, 6s
        console.warn(`RSS rate limited for r/${name}, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`);
        await delay(backoff);
        continue;
      }
      throw err;
    }
  }
}

async function fetchHotPosts(subreddit) {
  const name = normalizeSubreddit(subreddit);

  // Check cache first
  const cached = postCache.get(name);
  if (cached && Date.now() < cached.expiresAt) {
    return { name, posts: cached.data };
  }

  const token = await getAccessToken();

  try {
    let posts;
    if (token) {
      // Try OAuth first, fall back to RSS on failure
      try {
        posts = await fetchOAuthPosts(name, token);
      } catch (oauthErr) {
        console.warn('OAuth fetch failed, falling back to RSS:', oauthErr.response?.status || oauthErr.message);
        posts = await fetchRssPosts(name);
      }
    } else {
      posts = await fetchRssPosts(name);
    }

    // Cache successful results
    postCache.set(name, { data: posts, expiresAt: Date.now() + CACHE_TTL_MS });

    return { name, posts };
  } catch (error) {
    mapRedditError(error);
  }
}

module.exports = { fetchHotPosts, normalizeSubreddit };
