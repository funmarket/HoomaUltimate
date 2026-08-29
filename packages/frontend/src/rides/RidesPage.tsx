export function RidesPage() {
  return (
    <section className="page rides-page">
      <header className="rides-page__header panel">
        <span className="eyebrow">RIDE</span>
        <h1>Ride</h1>
        <p>Rides to matches and events will become available after the Rides domain is built.</p>
      </header>

      <section className="rides-empty panel">
        <span className="eyebrow">TO THE MATCH</span>
        <h2>No rides are available yet.</h2>
        <p className="muted">
          This shell does not list drivers, request location access, create bookings, or pretend
          matching exists before the owning Ride slice is implemented.
        </p>
      </section>
    </section>
  );
}
