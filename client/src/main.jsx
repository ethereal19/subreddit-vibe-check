import './styles.css';

const mount = document.getElementById('root');

function showBootError(error) {
  console.error('Dashboard startup failed:', error);
  mount.innerHTML = `
    <main class="boot-error" role="alert">
      <div class="boot-error__mark">!</div>
      <p class="eyebrow">Startup issue</p>
      <h1>The dashboard couldn't start.</h1>
      <p>Refresh the page once. If this message remains, copy the detail below and share it with us.</p>
      <code>${String(error?.message || error).replace(/[<>&]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[character]))}</code>
    </main>`;
}

async function boot() {
  try {
    const [{ StrictMode, createElement }, { createRoot }, { default: App }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('./App')
    ]);
    createRoot(mount).render(createElement(StrictMode, null, createElement(App)));
  } catch (error) {
    showBootError(error);
  }
}

boot();
