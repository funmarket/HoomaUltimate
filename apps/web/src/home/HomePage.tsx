import { HoomaNowSection } from "@hooma/frontend";
import { HomeGateway } from "@hooma/ui";

export function HomePage() {
  return (
    <>
      <HomeGateway />
      <div className="hooma-lane--content">
        <HoomaNowSection />
      </div>
    </>
  );
}
