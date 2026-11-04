import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Mask, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The dotted notebook paper behind a note.
 *
 * The mask is radial and struck from a corner, so the dots are densest where
 * the page begins and fall away across it. A top-to-bottom ramp left the field
 * ending in a hard square edge at the sides; a bloom centred in the page reads
 * as a spotlight. From the corner there is no edge and no centre — just paper
 * running out.
 *
 * The gradient is an ellipse, wider than it is tall, so the fade follows the
 * shape of the page rather than describing a circle on it: it carries off the
 * side of the screen, and is spent before it reaches the foot of the box.
 */
export function PaperDots({
  height = 760,
  /** Where the bloom is struck, as a share of the box: the top-left corner. */
  origin = { x: 0, y: 0 },
  /**
   * How far it reaches across, as a share of the box. Past 1 it runs off the
   * side of the screen, which is what the edge of a page does.
   */
  spread = 1.4,
  /**
   * How far it reaches down. Kept under 1 on purpose: the box has a bottom, and
   * a fade still lit when it gets there ends in a seam across the page.
   */
  fall = 0.95,
  /** Size of the dot grid; larger spaces the dots further apart. */
  scale = 1,
}: {
  height?: number;
  origin?: { x: number; y: number };
  spread?: number;
  fall?: number;
  scale?: number;
}) {
  return (
    <Svg style={[StyleSheet.absoluteFill, { height }]} pointerEvents="none">
      <Defs>
        <Pattern
          id="dots"
          width={20 * scale}
          height={20 * scale}
          patternUnits="userSpaceOnUse"
        >
          <Circle
            cx={1.6 * scale}
            cy={1.6 * scale}
            r={1.3 * scale}
            fill="rgba(160,150,132,0.32)"
          />
        </Pattern>
        <RadialGradient
          id="fade"
          cx={`${(origin.x * 100).toFixed(1)}%`}
          cy={`${(origin.y * 100).toFixed(1)}%`}
          rx={`${(spread * 100).toFixed(1)}%`}
          ry={`${(fall * 100).toFixed(1)}%`}
        >
          {/* Stops rather than two ends: a straight ramp reads as a visible
              ring, and easing it off keeps the edge from showing. */}
          <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="0.3" stopColor="#ffffff" stopOpacity="0.86" />
          <Stop offset="0.55" stopColor="#ffffff" stopOpacity="0.5" />
          <Stop offset="0.8" stopColor="#ffffff" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        <Mask id="mask">
          <Rect width="100%" height="100%" fill="url(#fade)" />
        </Mask>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#dots)" mask="url(#mask)" />
    </Svg>
  );
}
