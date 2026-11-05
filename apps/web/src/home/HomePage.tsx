import { HoomaNowSection, PageBanner } from "@hooma/frontend";
import { HomeGateway } from "@hooma/ui";

export function HomePage() {
  return (
    <>
      <PageBanner placementId="HOME_TOP" className="page-banner--home" />
      <HomeGateway />
      <div className="hooma-lane--content">
        <HoomaNowSection />
      </div>
    </>
  );
}
