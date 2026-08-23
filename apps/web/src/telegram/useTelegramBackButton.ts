import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { TelegramRuntime } from "./runtime";

export function useTelegramBackButton(runtime: TelegramRuntime): void {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const button = runtime.backButton;
    if (!button) return;

    const goBack = () => navigate(-1);
    if (location.pathname === "/" || location.pathname === "/telegram") {
      button.hide();
      return;
    }

    button.show();
    button.onClick(goBack);
    return () => {
      button.offClick(goBack);
    };
  }, [location.pathname, navigate, runtime.backButton]);
}
