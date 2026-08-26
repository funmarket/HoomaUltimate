import { useLayoutEffect, useRef } from "react";

export function FitSingleLineText({
  text,
  className,
  minFontSize,
  maxFontSize,
}: {
  readonly text: string;
  readonly className?: string;
  readonly minFontSize: number;
  readonly maxFontSize: number;
}) {
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    const container = element?.parentElement;
    if (!element || !container) return;

    const fit = () => {
      element.style.fontSize = `${maxFontSize}px`;
      const availableWidth = element.clientWidth;
      const requiredWidth = element.scrollWidth;
      if (!availableWidth || requiredWidth <= availableWidth) return;

      let nextSize = Math.max(
        minFontSize,
        Math.floor((maxFontSize * availableWidth) / requiredWidth),
      );
      element.style.fontSize = `${nextSize}px`;

      while (nextSize > minFontSize && element.scrollWidth > element.clientWidth) {
        nextSize -= 1;
        element.style.fontSize = `${nextSize}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [maxFontSize, minFontSize, text]);

  return (
    <span ref={textRef} className={className} title={text}>
      {text}
    </span>
  );
}
