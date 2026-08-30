import type { ImgHTMLAttributes } from "react";

export type ContainedImageProps = ImgHTMLAttributes<HTMLImageElement>;

/**
 * Canonical HOOMA presentation for user-supplied imagery that must remain fully visible.
 * The owning feature controls container geometry; this component controls only image fitting.
 */
export function ContainedImage({ style, ...props }: ContainedImageProps) {
  return (
    <img
      {...props}
      style={{
        ...style,
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "contain",
        objectPosition: "center",
      }}
    />
  );
}
