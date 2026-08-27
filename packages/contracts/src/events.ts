export type PublicEventStatus = "PUBLISHED" | "CANCELLED" | "COMPLETED";

export type PublicEventVenueAuthority =
  | "OFFICIAL_VENUE"
  | "SUGGESTED_BY_COMMUNITY"
  | null;

export type PublicEventPlace = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly address: string;
  readonly city: string | null;
  readonly houma: string | null;
  readonly imageUrl: string | null;
  readonly category: string | null;
};

export type PublicEventPlayDetails = {
  readonly eventId: string;
  readonly pitchType: string;
  readonly skillLevel: string;
  readonly format: string;
};

export type PublicWatchMatchDetails = {
  readonly eventId: string;
  readonly kind: "MATCH";
  readonly teamOneName: string;
  readonly teamOneLogoUrl: string | null;
  readonly teamTwoName: string;
  readonly teamTwoLogoUrl: string | null;
};

export type PublicWatchCulturalDetails = {
  readonly kind: "CULTURAL";
  readonly culturalCategory:
    | "MUSIC"
    | "CONCERT"
    | "COMEDY"
    | "ART"
    | "SCREENING"
    | "FOOD"
    | "COMMUNITY"
    | "OTHER";
  readonly imageUrl: string | null;
};

export type PublicEvent = {
  readonly id: string;
  readonly communityId: string | null;
  readonly placeId: string | null;
  readonly type: "PLAY" | "WATCH";
  readonly status: PublicEventStatus;
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly timezone: string;
  readonly venueName: string | null;
  readonly address: string | null;
  readonly capacity: number | null;
  readonly waitlistEnabled: boolean;
  readonly entryFeeMinor: string;
  readonly currency: string;
  readonly community: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  } | null;
  readonly place: PublicEventPlace | null;
  readonly venueAuthority: PublicEventVenueAuthority;
  readonly playDetails: PublicEventPlayDetails | null;
  readonly watchDetails:
    | PublicWatchMatchDetails
    | PublicWatchCulturalDetails
    | null;
  readonly _count: { readonly rsvps: number; readonly checkIns: number };
};

export type PublicEventPage = {
  readonly items: PublicEvent[];
  readonly nextCursor: string | null;
};
