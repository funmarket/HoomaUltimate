import { HoomaNowSection, PageBanner } from "@hooma/frontend";
import { HomeGateway } from "@hooma/ui";

export function HomePage() {
  return (
    <>
      <div className="hooma-lane--media">\n        <PageBanner placementId="HOME_TOP" />\n      </div>
      <HomeGateway />
      <div className="hooma-lane--content">
        <HoomaNowSection />
      </div>
    </>
  );
}
