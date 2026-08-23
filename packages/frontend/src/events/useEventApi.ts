import { useMemo } from "react";
import { useHoomaFrontend } from "../context";
import { createEventApi } from "./api";

export function useEventApi() {
  const { transport } = useHoomaFrontend();
  return useMemo(() => createEventApi(transport), [transport]);
}
