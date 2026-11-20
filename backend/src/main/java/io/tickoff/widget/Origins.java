package io.tickoff.widget;

import java.net.URI;
import java.util.Locale;

/** Böngészős "origin" (séma + host + port) számítása és összehasonlítása. */
public final class Origins {

    private Origins() {
    }

    /**
     * Az URL origin-je, ahogy a böngésző az {@code Origin} fejlécben küldi: kisbetűs séma és host,
     * az alapértelmezett port (80/443) elhagyva. Érvénytelen vagy nem http(s) URL esetén {@code null}.
     */
    public static String of(String url) {
        if (url == null) return null;
        try {
            URI uri = URI.create(url.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null) return null;
            scheme = scheme.toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) return null;
            int port = uri.getPort();
            boolean defaultPort = port == -1 || (scheme.equals("http") && port == 80) || (scheme.equals("https") && port == 443);
            return scheme + "://" + host.toLowerCase(Locale.ROOT) + (defaultPort ? "" : ":" + port);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static boolean sameOrigin(String a, String b) {
        String oa = of(a);
        return oa != null && oa.equals(of(b));
    }
}
