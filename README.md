# The Subreddit Vibe Check

A full-stack dashboard that reads the current Hot posts from a subreddit, analyzes the sentiment of each title, and presents the subreddit’s overall mood in a clear, responsive interface.

![Architecture](https://img.shields.io/badge/architecture-React_%E2%86%92_Express_%E2%86%92_Reddit-ff4500)

## What it does

- Fetches up to 50 Hot posts for a supplied subreddit.
- Scores every post title as positive, neutral, or negative.
- Calculates counts, percentages, and average sentiment.
- Shows a responsive donut chart, summary cards, and links back to Reddit.
- Handles empty input, missing subreddits, rate limits, network errors, no-post results, and loading states.

## Subreddits you can search

You can search any public subreddit with a valid name containing 3–21 letters, numbers, or underscores. Enter the name in any of these formats:

- `technology`
- `r/technology`
- `https://www.reddit.com/r/technology/`

For example, try `technology`, `programming`, `reactjs`, `news`, `gaming`, or any other public subreddit.

## Author

Reddit: [u/After-Yellow4789](https://www.reddit.com/user/After-Yellow4789/)

## Stack

- **Client:** React, Vite, Axios, CSS-native donut visualization
- **Server:** Node.js, Express, Axios, Sentiment, CORS, dotenv
- **Data:** Reddit API (OAuth when credentials are configured; public listing fallback for local exploration)

## Architecture

```
React dashboard → Express API → Reddit Hot listing
                       ↓
                 Sentiment analysis
                       ↓
              processed response → dashboard
```

Reddit secrets are read only by the server. No credential is bundled into the React app.

## Run locally

Prerequisite: Node.js 20 or newer.

```bash
npm install
npm install --prefix server
npm install --prefix client
copy .env.example server\.env
copy .env.example client\.env
npm run dev
```

Open `http://localhost:5173`. The server health check is available at `http://localhost:5000/api/health`.

### Environment variables

Put server values in `server/.env`:

| Name | Required | Purpose |
| --- | --- | --- |
| `REDDIT_CLIENT_ID` | Recommended | OAuth app ID from Reddit preferences |
| `REDDIT_CLIENT_SECRET` | Recommended | OAuth app secret |
| `REDDIT_USER_AGENT` | Recommended | Identifies the API client to Reddit |
| `PORT` | No | API port; defaults to 5000 |
| `CLIENT_ORIGIN` | No | Allowed frontend origin |

Put `VITE_API_URL` in `client/.env` for a non-local API base URL. The server can use the public Reddit listing endpoint when OAuth credentials are absent, but OAuth is recommended for deployed use and higher reliability.

## API

### `GET /api/health`

Returns server status.

### `GET /api/subreddit/:subreddit`

Returns normalized subreddit data, summary statistics, and analyzed posts.

```json
{
  "subreddit": { "name": "technology", "displayName": "r/technology" },
  "statistics": {
    "totalPosts": 50,
    "positive": { "count": 18, "percentage": 36 },
    "neutral": { "count": 22, "percentage": 44 },
    "negative": { "count": 10, "percentage": 20 },
    "averageSentiment": 0.72
  },
  "posts": []
}
```

## Deploy

### Live deployment

- **Frontend:** https://subreddit-vibe-check-od8430cg0-polus-projects-14ff281d.vercel.app/
- **API:** https://subreddit-vibe-check-1-hlnj.onrender.com/
- **API health check:** https://subreddit-vibe-check-1-hlnj.onrender.com/api/health

### Render (API)

Create a Web Service with root directory `server`, build command `npm install`, and start command `npm start`. Add the Reddit and `CLIENT_ORIGIN` variables from the table above.

### Vercel (client)

Import the repository, set the root directory to `client`, and set `VITE_API_URL` to the public API URL. Redeploy after changing the variable. Update `CLIENT_ORIGIN` in the API to the Vercel URL.

## Security checklist

- Keep `server/.env` and `client/.env` out of source control.
- Use placeholder values only in `.env.example`.
- Never expose Reddit’s client secret or any password in client code, screenshots, or documentation.
