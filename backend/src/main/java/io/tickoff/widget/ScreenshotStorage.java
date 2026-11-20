package io.tickoff.widget;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * A képernyőképeket fájlrendszerben tároljuk, az adatbázisban csak a relatív útvonal van.
 * Az útvonalat kizárólag számokból (projekt- és komment-azonosító) építjük, így nincs path traversal.
 */
@Component
public class ScreenshotStorage {

    private final Path baseDir;

    public ScreenshotStorage(@Value("${tickoff.storage-dir}") String dir) {
        this.baseDir = Path.of(dir).toAbsolutePath().normalize();
    }

    /** Elmenti a képet, és visszaadja a tárolóhoz viszonyított útvonalat (pl. {@code 3/17.png}). */
    public String save(long projectId, long commentId, String extension, byte[] data) throws IOException {
        String relative = projectId + "/" + commentId + "." + extension;
        Path target = resolve(relative);
        Files.createDirectories(target.getParent());
        Path tmp = Files.createTempFile(target.getParent(), "upload-", ".tmp");
        try {
            Files.write(tmp, data);
            Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            Files.deleteIfExists(tmp);
        }
        return relative;
    }

    public Path resolve(String relative) {
        Path p = baseDir.resolve(relative).normalize();
        if (!p.startsWith(baseDir)) {
            throw new IllegalArgumentException("Érvénytelen útvonal");
        }
        return p;
    }
}
