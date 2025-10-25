const app = document.getElementById('app');
app.innerHTML = `
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto; padding: 24px; max-width: 820px; margin: 0 auto;">
    <h1>tool</h1>
    <p>Vite + PWA 最小実装。Service Worker は Stale-While-Revalidate で動作します。</p>
  </main>
`;
