import { HoomaNowSection, PageBanner } from "@hooma/frontend";
import { HomeGateway } from "@hooma/ui";

export function HomePage() {
  return (
    <>
      <div className="hooma-lane--media">
        <PageBanner
          placementId="HOME_TOP"
          className="page-banner--home"
          fallback={
            <a
              className="page-banner__fallback-link page-banner__fallback-link--home"
              href="/play"
              aria-label="Match Day — open Play"
            >
              <img
                className="page-banner__fallback-image page-banner__fallback-image--home"
                src="/home-hero/matchday.webp"
                alt="Match Day — Play together. Watch together. Move as one. Create or join a HOOMA community to get started."
                width={1850}
                height={850}
                loading="eager"
                decoding="sync"
                fetchPriority="high"
              />
            </a>
          }
        />
      </div>
      <HomeGateway />
      <div className="hooma-lane--content">
        <HoomaNowSection />
      </div>
    </>
  );
}
