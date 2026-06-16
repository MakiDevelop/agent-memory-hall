<script>
  import "../app.css";
  let { children } = $props();
</script>

<div class="app">
  <header>
    <nav>
      <a href="/" class="logo">ACA Inspector</a>
      <span class="version">v0.1.0</span>
      <div class="nav-links">
        <a href="/" class="nav-link">Overview</a>
        <a href="/memories" class="nav-link">Memories</a>
      </div>
    </nav>
  </header>
  <main>
    {@render children()}
  </main>
</div>

<style>
  .app {
    min-height: 100vh;
  }
  header {
    border-bottom: 1px solid var(--border);
    padding: 12px 24px;
    background: var(--bg-card);
  }
  nav {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .logo {
    font-size: 16px;
    font-weight: 700;
    color: var(--accent);
    text-decoration: none;
    font-family: var(--font-mono);
  }
  .version {
    font-size: 12px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
  .nav-links {
    display: flex;
    gap: 16px;
    margin-left: auto;
  }
  .nav-link {
    font-size: 13px;
    color: var(--text-dim);
    text-decoration: none;
    transition: color 0.15s;
  }
  .nav-link:hover { color: var(--accent); }
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
  }
</style>
