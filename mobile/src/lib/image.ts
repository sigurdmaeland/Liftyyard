import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Gjør et valgt bilde klart for opplasting: JPEG (iPhone lagrer ofte HEIC, som serveren ikke leser),
 * maks `maxSide` piksler på lengste side og uten metadata. Serveren skalerer og renser i tillegg.
 */
export async function toUploadableJpeg(asset: { uri: string; width: number; height: number }, maxSide = 2048): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width, asset.height);
  if (longest > maxSide) {
    context.resize(asset.width >= asset.height ? { width: maxSide, height: null } : { width: null, height: maxSide });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return result.uri;
}

/** Åpner bildebiblioteket og returnerer et JPEG klart for opplasting, eller null hvis brukeren avbrøt. */
export async function pickJpeg(options: { square?: boolean; maxSide?: number } = {}): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: options.square ?? false,
    aspect: options.square ? [1, 1] : undefined,
    quality: 1,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return toUploadableJpeg(asset, options.maxSide);
}
