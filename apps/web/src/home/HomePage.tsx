import { HoomaNowSection, PageBanner } from "@hooma/frontend";
import { HomeHero, HomeGateway } from "@hooma/ui";
export function HomePage() { return <><PageBanner placementId="HOME_TOP">{({ artwork }) => <HomeGateway hero={artwork ? <HomeHero artwork={{src:artwork.variant.contentUrl,alt:artwork.slide.isDecorative?"":artwork.slide.altText??"",width:artwork.variant.widthPx,height:artwork.variant.heightPx}} /> : undefined} />}</PageBanner><div className="hooma-lane--content"><HoomaNowSection /></div></>; }
