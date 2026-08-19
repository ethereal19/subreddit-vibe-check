import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const client = axios.create({ baseURL: `${baseURL.replace(/\/$/, '')}/api`, timeout: 20000 });

export async function analyzeSubreddit(subreddit) {
  const response = await client.get(`/subreddit/${encodeURIComponent(subreddit)}`);
  return response.data;
}

export function messageFromError(error) {
  if (error.response?.data?.error?.message) return error.response.data.error.message;
  if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (!error.response) return 'Unable to connect to the server. Please try again.';
  return 'Something went wrong. Please try again.';
}
