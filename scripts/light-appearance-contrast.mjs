function over(foreground, background, opacity = 1) {
  const alpha = foreground[3] * opacity;
  const outputAlpha = alpha + background[3] * (1 - alpha);
  if (outputAlpha === 0) return [0, 0, 0, 0];
  return [
    (foreground[0] * alpha + background[0] * background[3] * (1 - alpha)) / outputAlpha,
    (foreground[1] * alpha + background[1] * background[3] * (1 - alpha)) / outputAlpha,
    (foreground[2] * alpha + background[2] * background[3] * (1 - alpha)) / outputAlpha,
    outputAlpha,
  ];
}

function luminance([red, green, blue]) {
  return [red, green, blue]
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

export function contrastAfterOpacity({
  foreground,
  surface,
  backdrop,
  foregroundOpacity,
  groupOpacity,
}) {
  const textOnSurface = over(foreground, surface, foregroundOpacity);
  const visibleForeground = over(textOnSurface, backdrop, groupOpacity);
  const visibleBackground = over(surface, backdrop, groupOpacity);
  const values = [luminance(visibleForeground), luminance(visibleBackground)].sort((a, b) => b - a);
  return {
    foreground: visibleForeground,
    background: visibleBackground,
    ratio: (values[0] + 0.05) / (values[1] + 0.05),
  };
}

export function hasOverlappingMedia(textRect, mediaRects) {
  return mediaRects.some(
    ([left, top, right, bottom]) =>
      textRect[0] < right && textRect[2] > left && textRect[1] < bottom && textRect[3] > top,
  );
}

export function samplePixelsInRect({
  data,
  width,
  height,
  channels,
  rect,
  scaleX = 1,
  scaleY = 1,
  maxSamples = 256,
}) {
  if (channels < 3 || width <= 0 || height <= 0 || maxSamples <= 0) return [];
  const left = Math.max(0, Math.floor(rect[0] * scaleX));
  const top = Math.max(0, Math.floor(rect[1] * scaleY));
  const right = Math.min(width, Math.ceil(rect[2] * scaleX));
  const bottom = Math.min(height, Math.ceil(rect[3] * scaleY));
  if (right <= left || bottom <= top) return [];

  const area = (right - left) * (bottom - top);
  const step = Math.max(1, Math.ceil(Math.sqrt(area / maxSamples)));
  const samples = [];
  for (let y = top; y < bottom; y += step) {
    for (let x = left; x < right; x += step) {
      const offset = (y * width + x) * channels;
      samples.push([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        channels >= 4 ? data[offset + 3] / 255 : 1,
      ]);
    }
  }
  return samples;
}
