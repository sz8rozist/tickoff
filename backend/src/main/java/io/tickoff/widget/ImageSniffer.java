package io.tickoff.widget;

import java.util.Optional;

/**
 * Képtípus felismerése a fájl első bájtjaiból. A kliens által küldött Content-Type nem megbízható, ezért a tartalom
 * dönt. Csak rasztergrafikus formátumok engedélyezettek: SVG nincs közöttük (a script futtatható lenne benne).
 */
public final class ImageSniffer {

    public record Type(String extension, String contentType) {
    }

    private ImageSniffer() {
    }

    public static Optional<Type> detect(byte[] d) {
        if (starts(d, 0, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) return Optional.of(new Type("png", "image/png"));
        if (starts(d, 0, 0xFF, 0xD8, 0xFF)) return Optional.of(new Type("jpg", "image/jpeg"));
        if (starts(d, 0, 'G', 'I', 'F', '8') && d.length > 5 && (d[4] == '7' || d[4] == '9') && d[5] == 'a') {
            return Optional.of(new Type("gif", "image/gif"));
        }
        // WebP: "RIFF" <4 bájt méret> "WEBP"
        if (starts(d, 0, 'R', 'I', 'F', 'F') && starts(d, 8, 'W', 'E', 'B', 'P')) {
            return Optional.of(new Type("webp", "image/webp"));
        }
        return Optional.empty();
    }

    private static boolean starts(byte[] d, int offset, int... expected) {
        if (d.length < offset + expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if ((d[offset + i] & 0xFF) != expected[i]) return false;
        }
        return true;
    }
}
