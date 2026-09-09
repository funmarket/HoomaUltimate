import type { AthletesSport } from "@hooma/contracts/athletes";
export const sports: readonly { value: AthletesSport; label: string }[] = [
  { value: "CYCLING", label: "Cycling" },
  { value: "RUNNING", label: "Running" },
  { value: "SWIMMING", label: "Swimming" },
  { value: "FOOTBALL", label: "Football" },
  { value: "BASKETBALL", label: "Basketball" },
  { value: "TENNIS", label: "Tennis" },
  { value: "PADEL", label: "Padel" },
  { value: "GYM_FITNESS", label: "Gym/Fitness" },
  { value: "OTHER", label: "Other" },
];

export function sportLabel(value: AthletesSport): string {
  return sports.find((sport) => sport.value === value)?.label ?? value;
}
