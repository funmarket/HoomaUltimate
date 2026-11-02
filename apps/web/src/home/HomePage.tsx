import { HoomaNowSection, PageBanner } from "@hooma/frontend";
import { HomeGateway } from "@hooma/ui";

export function HomePage() {
  return (
    <>
      <PageBanner placementId="HOME_TOP">
        {() => (
          <a className="page-banner--home" href="/play" aria-label="Match Day — open Play">
            <img
              className="page-banner--home__image"
              src="/home-hero/matchday.webp"
              alt="Match Day — Play together. Watch together. Move as one. Create or join a HOOMA community to get started."
              width={1850}
              height={850}
              loading="eager"
              decoding="sync"
              fetchPriority="high"
            />
          </a>
        )}
      </PageBanner>
      <HomeGateway />
      <div className="hooma-lane--content">
        <HoomaNowSection />
      </div>
    </>
  );
}
