import { CalendarIcon, CalendarPlusIcon, MenuIcon, PinIcon } from "../ui/HoomaIcons";

export type WatchSectionDestination = "events" | "spots" | "gear-up";

function destinationClass(active: boolean): string {
  return active ? "watch-section-action is-active" : "watch-section-action";
}

export function WatchSectionNavigation({
  active,
  createEventHref = "/events/new?type=WATCH&kind=MATCH",
}: {
  readonly active: WatchSectionDestination;
  readonly createEventHref?: string;
}) {
  return (
    <>
      <nav className="watch-section-actions" aria-label="Watch destinations">
        <a
          className={destinationClass(active === "events")}
          href="/watch"
          aria-current={active === "events" ? "page" : undefined}
        >
          <CalendarIcon size={28} className="watch-section-action__icon" />
          <span>Events</span>
        </a>
        <a
          className={destinationClass(active === "spots")}
          href="/places"
          aria-current={active === "spots" ? "page" : undefined}
        >
          <PinIcon size={28} className="watch-section-action__icon" />
          <span>Spots</span>
        </a>
        <a
          className={destinationClass(active === "gear-up")}
          href="/gear-up"
          aria-current={active === "gear-up" ? "page" : undefined}
        >
          <MenuIcon size={28} className="watch-section-action__icon" />
          <span>Gear Up</span>
        </a>
      </nav>

      <div className="watch-section-utilities" role="group" aria-label="Watch actions">
        <a className="watch-section-action watch-section-action--utility" href={createEventHref}>
          <CalendarPlusIcon size={22} className="watch-section-action__icon" />
          <span>Create Event</span>
        </a>
        <a className="watch-section-action watch-section-action--utility" href="/places/new">
          <PinIcon size={22} className="watch-section-action__icon" />
          <span>Add a Place</span>
        </a>
      </div>
    </>
  );
}
