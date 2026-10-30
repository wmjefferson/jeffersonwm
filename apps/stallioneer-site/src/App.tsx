function App() {
  const openAuth = () => {
    const returnTo = encodeURIComponent(window.location.href);
    window.open(
      `https://auth.jeffersonwm.com/?returnTo=${returnTo}`,
      "jeffersonwm-auth",
      "width=520,height=720,noopener,noreferrer"
    );
  };

  return (
    <>
      <header className="page-banner page-banner--top">
        <div className="shell-frame shell-frame--topbar">
          <a className="page-banner__brand" href="https://jeffersonwm.com/">
            Stallioneer - Under Construction
          </a>
          <button className="page-banner__button" type="button" onClick={openAuth}>
            Sign In
          </button>
        </div>
      </header>

      <div className="shell-gutters" aria-hidden="true">
        <div className="shell-gutter shell-gutter--left" />
        <div className="shell-gutter shell-gutter--right" />
      </div>

      <main className="shell-frame shell-frame--body" aria-label="Under construction" />

      <footer className="page-banner page-banner--bottom">
        <div className="shell-frame page-banner__inner">
          <p className="page-banner__copyright">
            © 2026{" "}
            <a
              className="page-banner__copyright-link page-banner__copyright-link--primary"
              href="https://jeffersonwm.com/"
            >
              Jefferson Williams
            </a>
            . All rights reserved.{" "}
            <a
              className="page-banner__copyright-link"
              href="https://github.com/williamjefferson"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </footer>
    </>
  );
}

export default App;
