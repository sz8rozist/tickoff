package io.tickoff.widget;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.stream.Stream;

/**
 * A képernyőképeket fájlrendszerben tároljuk, az adatbázisban csak a relatív útvonal van.
 * Az útvonalat kizárólag számokból (projekt- és komment-azonosító) építjük, így nincs path traversal.
 */
@Component
public class ScreenshotStorage {

    private static final Logger log = LoggerFactory.getLogger(ScreenshotStorage.class);

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

    /** Egy kép törlése. Ha nincs ilyen fájl, nem hiba. A hibát naplózzuk, de nem dobjuk tovább: a törlés fő része már megtörtént. */
    public void delete(String relative) {
        if (relative == null) return;
        try {
            Files.deleteIfExists(resolve(relative));
        } catch (IOException | IllegalArgumentException e) {
            log.warn("A képernyőkép nem törölhető: {}", relative, e);
        }
    }

    /** Egy projekt összes képének törlése (a projekt vagy a tulajdonos fiókjának törlésekor). */
    public void deleteProject(long projectId) {
        Path dir = resolve(String.valueOf(projectId));
        if (!Files.isDirectory(dir)) return;
        try (Stream<Path> paths = Files.walk(dir)) {
            // Mélyebb elemek előbb, hogy a könyvtárak üresen törölhetők legyenek
            for (Path p : (Iterable<Path>) paths.sorted(Comparator.reverseOrder())::iterator) {
                Files.deleteIfExists(p);
            }
        } catch (IOException e) {
            log.warn("A projekt képei nem törölhetők teljesen: {}", projectId, e);
        }
    }

    public Path resolve(String relative) {
        Path p = baseDir.resolve(relative).normalize();
        if (!p.startsWith(baseDir)) {
            throw new IllegalArgumentException("Érvénytelen útvonal");
        }
        return p;
    }
}
