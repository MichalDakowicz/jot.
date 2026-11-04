import { Appearance } from 'react-native';

import { applyScheme } from '@jot/core/theme/scheme';

// Screens read the palette when their stylesheets are made, so the scheme is
// settled before the router loads any of them. It follows the phone's setting
// at launch.
applyScheme(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

require('expo-router/entry');
