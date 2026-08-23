type PlayHeroProps = {
  readonly createHref?: string;
};

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function PlayHero({ createHref = "/events/new" }: PlayHeroProps) {
  return (
    <section className="play-hero-pro">
      <div>
        <span>Pickup football</span>
        <h1>PLAY</h1>
        <p>Find a game. Find players. Get on the pitch.</p>
      </div>
      <a className="play-hero-pro__action" href={createHref}>
        <PlusIcon />
        Create match
      </a>
    </section>
  );
}
