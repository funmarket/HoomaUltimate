const HOME_HERO_STYLES = `
.home-hero {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1850 / 850;
  margin: 0.15rem 0 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(214, 171, 84, 0.52);
  border-radius: clamp(12px, 2.2vw, 22px);
  background: #030403;
  box-shadow:
    0 16px 34px rgba(0, 0, 0, 0.34),
    inset 0 0 0 1px rgba(255, 238, 192, 0.055);
}
.home-hero__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  user-select: none;
}
@media (max-width: 520px) {
  .home-hero { margin-top: 0.05rem; }
}
`;

export function HomeHero() {
  return (
    <>
      <style>{HOME_HERO_STYLES}</style>
      <div className="home-hero" aria-label="HOOMA Match Day">
        <img
          className="home-hero__image"
          src="/home-hero/matchday.webp"
          alt="Match Day — Play together. Watch together. Move as one. Create or join a HOOMA community to get started."
          width={1850}
          height={850}
          loading="eager"
          decoding="sync"
          fetchPriority="high"
        />
      </div>
    </>
  );
}
