import { HoomaNowSection, PageBanner } from "@hooma/frontend";
import { HomeGateway } from "@hooma/ui";

export function HomePage() {
  return (
    <>
      <div className="hooma-lane--media">
        <PageBanner
          placementId="HOME_TOP"
          className="page-banner--home"
        />
      </div>
      <HomeGateway />
      <div className="hooma-lane--content">
        <HoomaNowSection />
      </div>
    </>
  );
}
