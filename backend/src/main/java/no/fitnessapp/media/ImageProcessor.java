package no.fitnessapp.media;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import no.fitnessapp.common.BadRequestException;

/**
 * Leser et opplastet bilde (JPEG/PNG), beskjærer til kvadrat, skalerer ned og lagrer som ny JPEG.
 * Fordi bildet tegnes på nytt, følger ingen metadata med (EXIF, GPS-posisjon, kameradata).
 */
public final class ImageProcessor {

    private ImageProcessor() {}

    private static BufferedImage decode(byte[] input) {
        BufferedImage source;
        try {
            source = ImageIO.read(new ByteArrayInputStream(input));
        } catch (IOException e) {
            source = null;
        }
        if (source == null) throw new BadRequestException("Filen er ikke et bilde vi kan lese (bruk JPEG eller PNG)");
        if (source.getWidth() < 64 || source.getHeight() < 64) throw new BadRequestException("Bildet er for lite");
        return source;
    }

    /** Skalerer ned slik at lengste side er maks `maxSide`, uten beskjæring. Ny JPEG uten metadata. */
    public static byte[] fitJpeg(byte[] input, int maxSide) {
        BufferedImage source = decode(input);
        double scale = Math.min(1.0, (double) maxSide / Math.max(source.getWidth(), source.getHeight()));
        int w = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int h = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(source, 0, 0, w, h, null);
        g.dispose();
        return encode(out);
    }

    public static byte[] squareJpeg(byte[] input, int size) {
        BufferedImage source = decode(input);

        int side = Math.min(source.getWidth(), source.getHeight());
        int x = (source.getWidth() - side) / 2;
        int y = (source.getHeight() - side) / 2;
        int target = Math.min(size, side);
        BufferedImage out = new BufferedImage(target, target, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(source, 0, 0, target, target, x, y, x + side, y + side, null);
        g.dispose();
        return encode(out);
    }

    private static byte[] encode(BufferedImage out) {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream(); ImageOutputStream stream = ImageIO.createImageOutputStream(bytes)) {
            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.85f);
            writer.setOutput(stream);
            writer.write(null, new IIOImage(out, null, null), param);
            writer.dispose();
            stream.flush();
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
