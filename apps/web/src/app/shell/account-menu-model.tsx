/**
 * Account-navigation presentation composition for the application shell.
 *
 * This module owns no business state and performs no reads: it turns authority facts the
 * shell already holds into the generic sections/items the UI package renders. The shell
 * decides which destinations exist; the canonical domains still decide what the user may do
 * after navigating.
 */
import {
  AccountMenuSettingsIcon,
  AccountMenuShieldIcon,
  AccountMenuWhistleIcon,
  type HoomaAccountMenuSection,
} from "@hooma/ui";

export interface AccountMenuModelInput {
  readonly hasManagedTeams: boolean;
  readonly hasPlatformControlAccess: boolean;
  readonly onCoachControlRoom: () => void;
  readonly onSettings: () => void;
  readonly onPlatformControlRoom: () => void;
}

export function buildAccountMenuSections(
  input: AccountMenuModelInput,
): readonly HoomaAccountMenuSection[] {
  const sections: HoomaAccountMenuSection[] = [];

  if (input.hasManagedTeams) {
    sections.push({
      id: "control-centers",
      label: "Control centers",
      items: [
        {
          id: "coach-control-room",
          title: "Coach Control Room",
          subtitle: "Manage your Teams",
          icon: <AccountMenuWhistleIcon />,
          onSelect: input.onCoachControlRoom,
        },
      ],
    });
  }

  sections.push({
    id: "account",
    label: "Account",
    items: [
      {
        id: "settings-security",
        title: "Settings & Security",
        subtitle: "Account, login & appearance",
        icon: <AccountMenuSettingsIcon />,
        onSelect: input.onSettings,
      },
    ],
  });

  if (input.hasPlatformControlAccess) {
    sections.push({
      id: "platform",
      label: "Platform",
      items: [
        {
          id: "platform-control-room",
          title: "Platform Control Room",
          subtitle: "Operations, safety & administration",
          icon: <AccountMenuShieldIcon />,
          onSelect: input.onPlatformControlRoom,
        },
      ],
    });
  }

  return sections;
}
