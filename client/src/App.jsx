import React, { useState } from 'react';
import { analyzeSubreddit, messageFromError } from './api';

const COLORS = { positive: '#2dbb82', neutral: '#8892a5', negative: '#ee5b5b' };
const LABELS = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative' };

function normalizeInput(value) {
  return value.trim().replace(/^https?:\/\/(?:www\.)?reddit\.com\/r\//i, '').replace(/^\/?r\//i, '').replace(/^\//, '').replace(/\/$/, '');
}

function formatScore(score) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(score);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function StatCard({ type, data }) {
  return (
    <article className={`stat-card stat-card--${type}`}>
      <span className="stat-card__marker" />
      <p>{LABELS[type]}</p>
      <div className="stat-card__numbers"><strong>{data.count}</strong><span>{data.percentage}%</span></div>
      <div className="progress"><span style={{ width: `${data.percentage}%` }} /></div>
    </article>
  );
}

function Chart({ statistics }) {
  const data = ['positive', 'neutral', 'negative'].map((name) => ({ name: LABELS[name], value: statistics[name].count, key: name }));
  const positiveEnd = statistics.positive.percentage;
  const neutralEnd = positiveEnd + statistics.neutral.percentage;
  const chartStyle = {
    background: `conic-gradient(${COLORS.positive} 0% ${positiveEnd}%, ${COLORS.neutral} ${positiveEnd}% ${neutralEnd}%, ${COLORS.negative} ${neutralEnd}% 100%)`
  };
  return (
    <section className="panel chart-panel" aria-label="Sentiment distribution">
      <div className="section-heading"><div><p className="eyebrow">Distribution</p><h2>The mood split</h2></div></div>
      <div className="chart-wrap">
        <div className="donut" style={chartStyle} role="img" aria-label={`${statistics.positive.count} positive, ${statistics.neutral.count} neutral, and ${statistics.negative.count} negative posts`} />
        <div className="chart-center"><strong>{statistics.totalPosts}</strong><span>posts</span></div>
      </div>
      <div className="legend">
        {data.map((item) => <div key={item.key}><span style={{ backgroundColor: COLORS[item.key] }} />{item.name}<b>{item.value}</b></div>)}
      </div>
    </section>
  );
}

function PostCard({ post }) {
  return (
    <article className="post-card">
      <div className="post-card__main">
        <span className={`badge badge--${post.sentiment.label}`}>{LABELS[post.sentiment.label]}</span>
        <h3>{post.title}</h3>
        <div className="post-meta"><span>u/{post.author}</span><i>•</i><span>{formatScore(post.score)} points</span><i>•</i><span>{formatDate(post.createdAt)}</span></div>
      </div>
      <div className="post-card__side">
        <span className="sentiment-score">{post.sentiment.score > 0 ? '+' : ''}{post.sentiment.score}</span>
        <a href={post.permalink} target="_blank" rel="noreferrer" aria-label={`Open ${post.title} on Reddit`}>Open ↗</a>
      </div>
    </article>
  );
}

function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event) {
    event.preventDefault();
    const subreddit = normalizeInput(input);
    if (!subreddit) { setError('Please enter a subreddit name.'); setResult(null); return; }
    setLoading(true); setError('');
    try {
      const data = await analyzeSubreddit(subreddit);
      setResult(data);
      setInput(data.subreddit.name);
    } catch (requestError) {
      setError(messageFromError(requestError));
      setResult(null);
    } finally { setLoading(false); }
  }

  const stats = result?.statistics;
  return (
    <div className="app-shell">
      <header className="hero">
        <a className="brand" href="/" aria-label="The Subreddit Vibe Check home"><span className="brand-mark">r/</span><span>Vibe Check</span></a>
        <div className="hero__copy"><p className="eyebrow">Reddit, decoded</p><h1>What's the <em>vibe</em> today?</h1><p>Turn the latest Hot posts from any community into an instant mood read.</p></div>
        <form className="search" onSubmit={onSubmit} noValidate>
          <label htmlFor="subreddit">Subreddit to analyze</label>
          <div className="search__row"><span className="input-prefix">r/</span><input id="subreddit" value={input} onChange={(event) => setInput(event.target.value)} placeholder="technology" autoComplete="off" disabled={loading} /><button type="submit" disabled={loading}>{loading ? <><span className="spinner" />Reading the room</> : 'Analyze vibe →'}</button></div>
          <p className="search__hint">Try <button type="button" onClick={() => setInput('technology')}>technology</button>, <button type="button" onClick={() => setInput('programming')}>programming</button>, or <button type="button" onClick={() => setInput('reactjs')}>reactjs</button></p>
        </form>
      </header>

      <main>
        {error && <div className="notice notice--error" role="alert"><span>!</span><div><strong>We couldn’t analyze that subreddit</strong><p>{error}</p></div></div>}
        {loading && <section className="loading-state"><div className="loading-orb"><span /></div><h2>Analyzing r/{normalizeInput(input) || 'subreddit'}...</h2><p>Fetching the current Hot posts and reading the room.</p></section>}
        {!loading && !result && !error && <section className="empty-state"><div className="empty-illustration">✦</div><h2>Ready when you are.</h2><p>Enter a subreddit above to see what its latest conversations are feeling.</p></section>}
        {!loading && result && <>
          <section className="results-heading"><div><p className="eyebrow">Analysis complete</p><h2>{result.subreddit.displayName}</h2><p>Based on {stats.totalPosts} current Hot posts · updated just now</p></div><div className="average"><span>Average sentiment</span><strong className={stats.averageSentiment > 0 ? 'is-positive' : stats.averageSentiment < 0 ? 'is-negative' : ''}>{stats.averageSentiment > 0 ? '+' : ''}{stats.averageSentiment}</strong></div></section>
          {stats.totalPosts === 0 ? <section className="empty-state compact"><div className="empty-illustration">⌁</div><h2>No posts found.</h2><p>There aren’t any public Hot posts to analyze right now.</p></section> : <>
            <section className="dashboard-grid"><div className="stats-panel panel"><div className="section-heading"><div><p className="eyebrow">Snapshot</p><h2>At a glance</h2></div><span className="posts-total">{stats.totalPosts} posts</span></div><div className="stats-list"><StatCard type="positive" data={stats.positive} /><StatCard type="neutral" data={stats.neutral} /><StatCard type="negative" data={stats.negative} /></div></div><Chart statistics={stats} /></section>
            <section className="posts-section"><div className="section-heading"><div><p className="eyebrow">The source material</p><h2>Current Hot posts</h2></div><span>{result.posts.length} analyzed</span></div><div className="post-list">{result.posts.map((post) => <PostCard post={post} key={post.id} />)}</div></section>
          </>}
        </>}
      </main>
      <footer><span>Made for curious Redditors</span><span>Sentiment is inferred from post titles only.</span></footer>
    </div>
  );
}

export default App;
