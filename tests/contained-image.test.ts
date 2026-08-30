import assert from "node:assert/strict";
import test from "node:test";
import { ContainedImage } from "../packages/ui/src/media/ContainedImage.js";

test("ContainedImage preserves full-image fit and center even when caller styles try to crop", () => {
  const element = ContainedImage({
    src: "https://example.com/portrait.jpg",
    alt: "Portrait",
    style: {
      objectFit: "cover",
      objectPosition: "top",
      width: "17px",
      height: "23px",
    },
  });

  assert.equal(element.props.style.objectFit, "contain");
  assert.equal(element.props.style.objectPosition, "center");
  assert.equal(element.props.style.width, "100%");
  assert.equal(element.props.style.height, "100%");
  assert.equal(element.props.style.display, "block");
});
