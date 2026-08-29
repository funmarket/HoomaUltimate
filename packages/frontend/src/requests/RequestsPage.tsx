export type RequestsPageTab = "requests" | "fundme";

export function RequestsPage({ tab = "requests" }: { readonly tab?: RequestsPageTab }) {
  const fundmeActive = tab === "fundme";

  return (
    <section className="page requests-page">
      <header className="requests-page__header panel">
        <span className="eyebrow">REQUESTS</span>
        <h1>{fundmeActive ? "FundMe" : "Requests"}</h1>
        <p>
          {fundmeActive
            ? "Money support will sit with community needs here when Fundraising and Payments are implemented."
            : "Ask for gear or support around real football activity without pretending a claim flow exists yet."}
        </p>
      </header>

      <nav className="requests-tabs" aria-label="Requests sections">
        <a
          className={fundmeActive ? "requests-tab" : "requests-tab is-active"}
          href="/requests"
          aria-current={fundmeActive ? undefined : "page"}
        >
          Requests
        </a>
        <a
          className={fundmeActive ? "requests-tab is-active" : "requests-tab"}
          href="/requests/fundme"
          aria-current={fundmeActive ? "page" : undefined}
        >
          FundMe
        </a>
      </nav>

      {fundmeActive ? (
        <section className="requests-empty panel">
          <span className="eyebrow">FUNDME</span>
          <h2>FundMe is not taking contributions yet.</h2>
          <p className="muted">
            FundMe will support Requests with real fundraising and payment rails after that owning
            slice exists. There is no donation form or payment intent in this shell.
          </p>
        </section>
      ) : (
        <section className="requests-empty panel">
          <span className="eyebrow">GEAR AND SUPPORT</span>
          <h2>No Requests are listed yet.</h2>
          <p className="muted">
            The Requests surface is open for navigation, but request creation, claims, and
            fulfillment need their own authorized domain slice before they become interactive.
          </p>
        </section>
      )}
    </section>
  );
}
