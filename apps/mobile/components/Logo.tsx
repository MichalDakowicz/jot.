import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { LOGO_COLORS, LOGO_PATHS } from '@jot/core/theme/logo';

/** The square app mark: a monospace "j" and its square cursor on the slate tile. */
export function LogoMark({ size = 88, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect width={64} height={64} rx={LOGO_PATHS.tile.radius} fill={LOGO_COLORS.tile} />
        <Path d={LOGO_PATHS.dot} fill={LOGO_COLORS.letter} />
        <Path d={LOGO_PATHS.stem} fill={LOGO_COLORS.letter} />
        <Path d={LOGO_PATHS.caret} fill={LOGO_COLORS.caret} />
      </Svg>
    </View>
  );
}

