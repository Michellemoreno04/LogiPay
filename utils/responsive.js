import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Ancho y alto de referencia basados en dispositivo estándar (iPhone X / 11 / 12 standard)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

const scaleWidth = SCREEN_WIDTH / BASE_WIDTH;
const scaleHeight = SCREEN_HEIGHT / BASE_HEIGHT;

/**
 * Escala lineal basada en el ancho de la pantalla.
 * Ideal para: width, padding horizontal, margin horizontal, borderRadius.
 */
export const scale = (size) => Math.round(PixelRatio.roundToNearestPixel(size * scaleWidth));

/**
 * Escala lineal basada en la altura de la pantalla.
 * Ideal para: height, padding vertical, margin vertical.
 */
export const verticalScale = (size) => Math.round(PixelRatio.roundToNearestPixel(size * scaleHeight));

/**
 * Escala moderada recomendada para fuentes (fontSize):
 * Aplica un factor de amortiguación para que la tipografía se ajuste armónicamente
 * sin verse gigante en pantallas grandes ni ilegible en pantallas pequeñas.
 * @param {number} size - Tamaño base de fuente en px.
 * @param {number} factor - Nivel de escalado (0: tamaño fijo, 1: escalado 100% lineal, default 0.5).
 */
export const moderateScale = (size, factor = 0.5) => {
  return Math.round(PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor));
};

/**
 * Helper para normalizar el tamaño de fuente en toda la app.
 */
export const normalizeFontSize = (size) => moderateScale(size, 0.4);

/**
 * Constantes y flags útiles sobre el dispositivo actual
 */
export const isSmallDevice = SCREEN_WIDTH < 375;
export const isTablet = SCREEN_WIDTH >= 768;
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export { SCREEN_HEIGHT, SCREEN_WIDTH };

export default {
  scale,
  verticalScale,
  moderateScale,
  normalizeFontSize,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  isSmallDevice,
  isTablet,
  isIOS,
  isAndroid,
};
