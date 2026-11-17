import { useNavigate } from "react-router-dom";
import { HoomaNowSection, PageBanner, useHoomaFrontend } from "@hooma/frontend";
import { HomeGateway, PRIMARY_NAV_ITEMS } from "@hooma/ui";
import { navigateWithPageBannerPrefetch } from "../app/shell/page-banner-navigation";

export function HomePage() {
  const navigate = useNavigate();
  const { api } = useHoomaFrontend();
  return (
    <>
      <PageBanner placementId="HOME_TOP" className="page-banner--home" />
      <HomeGateway
        onNavigate={(href) =>
          navigateWithPageBannerPrefetch(
            href,
            PRIMARY_NAV_ITEMS,
            (placementId) => api.pageBanners.prefetch(placementId),
            navigate,
          )
        }
      />
      <div className="hooma-lane--content">
        <HoomaNowSection />
      </div>
    </>
  );
}
