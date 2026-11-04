import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * A notebook's colour mark: the rounded square of the app tile, drawn as a
 * path so it scales from a dot to a swatch.
 */
const SQUISH = 'M22 0H78C90 0 100 10 100 22V78C100 90 90 100 78 100H22C10 100 0 90 0 78V22C0 10 10 0 22 0Z';

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
