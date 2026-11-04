import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The design leans on one organic shape (a CSS `border-radius` with eight
 * different percentages). React Native has no such radius, so the same
 * squish is drawn as a path.
 */
const SQUISH = 'M60 0C88 0 100 18 100 50C100 78 82 100 45 100C18 100 0 80 0 50C0 20 26 0 60 0Z';

type Props = {
  size: number;
  color: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Blob({ size, color, opacity = 1, style, children }: Props) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Path d={SQUISH} fill={color} opacity={opacity} />
      </Svg>
      {children}
    </View>
  );
}
