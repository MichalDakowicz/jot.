import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'calendar'
  | 'book'
  | 'search'
  | 'tag'
  | 'plus'
  | 'pen'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'graph'
  | 'trash'
  | 'logout'
  | 'export'
;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 20, color = '#201e1d', strokeWidth = 2.75 }: Props) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'calendar' && (
        <>
          <Rect x={3} y={4} width={18} height={18} rx={5} {...common} />
          <Path d="M8 2v4" {...common} />
          <Path d="M16 2v4" {...common} />
          <Path d="M3 10h18" {...common} />
        </>
      )}
      {name === 'book' && (
        <>
          <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" {...common} />
          <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" {...common} />
        </>
      )}
      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={8} {...common} />
          <Path d="m21 21-4.3-4.3" {...common} />
        </>
      )}
      {name === 'tag' && (
        <>
          <Path
            d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"
            {...common}
          />
          <Path d="M7.5 7.5h.01" {...common} />
        </>
      )}
      {name === 'plus' && (
        <>
          <Path d="M5 12h14" {...common} strokeWidth={strokeWidth + 0.15} />
          <Path d="M12 5v14" {...common} strokeWidth={strokeWidth + 0.15} />
        </>
      )}
      {name === 'pen' && (
        <>
          <Path d="M12 20h9" {...common} />
          <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" {...common} />
        </>
      )}
      {name === 'check' && <Path d="M20 6 9 17l-5-5" {...common} />}
      {name === 'chevronLeft' && <Path d="m15 18-6-6 6-6" {...common} />}
      {name === 'chevronRight' && <Path d="m9 6 6 6-6 6" {...common} />}
      {name === 'graph' && (
        <>
          <Circle cx={18} cy={5} r={3} {...common} />
          <Circle cx={6} cy={12} r={3} {...common} />
          <Circle cx={18} cy={19} r={3} {...common} />
          <Path d="m8.6 13.5 6.8 4" {...common} />
          <Path d="m15.4 6.5-6.8 4" {...common} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M3 6h18" {...common} />
          <Path d="M8 6V4h8v2" {...common} />
          <Path d="M6 6l1 14h10l1-14" {...common} />
        </>
      )}
      {name === 'logout' && (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...common} />
          <Path d="m16 17 5-5-5-5" {...common} />
          <Path d="M21 12H9" {...common} />
        </>
      )}
      {name === 'export' && (
        <>
          <Path d="M12 3v12" {...common} />
          <Path d="m7 8 5-5 5 5" {...common} />
          <Path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" {...common} />
        </>
      )}
    </Svg>
  );
}
