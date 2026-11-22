package io.tickoff.webhook;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

/**
 * A webhook-cím ellenőrzése. A címet a felhasználó adja, a szerver pedig kéréseket küld rá, ezért (SSRF ellen)
 * csak nyilvános címre mutathat: https, nincs benne név/jelszó, és a név minden feloldott címe nyilvános
 * (nem loopback, nem privát, nem link-local, nem a belső hálózat). A fejlesztői környezet engedélyezheti a privát
 * címeket ({@code tickoff.webhook.allow-private}), éles üzemben ez ki van kapcsolva.
 *
 * <p>A feloldást minden küldés előtt újra elvégezzük, mert a DNS közben megváltozhatott. A küldő nem követ átirányítást.
 */
public final class WebhookUrls {

    private WebhookUrls() {
    }

    /** A cím (URI), vagy {@link IllegalArgumentException} magyar üzenettel. */
    public static URI validate(String url, boolean allowPrivate) {
        URI uri;
        try {
            uri = new URI(url.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException("Érvénytelen webhook-cím");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        boolean https = scheme.equals("https");
        if (!https && !(allowPrivate && scheme.equals("http"))) {
            throw new IllegalArgumentException("A webhook-cím https:// kezdetű legyen");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException("Érvénytelen webhook-cím");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalArgumentException("A webhook-cím ne tartalmazzon felhasználónevet vagy jelszót");
        }
        if (!allowPrivate) {
            InetAddress[] addresses;
            try {
                addresses = InetAddress.getAllByName(uri.getHost());
            } catch (UnknownHostException e) {
                throw new IllegalArgumentException("A webhook-cím neve nem oldható fel");
            }
            for (InetAddress a : addresses) {
                if (isInternal(a)) {
                    throw new IllegalArgumentException("A webhook-cím nem mutathat belső hálózatra");
                }
            }
        }
        return uri;
    }

    /** Nem nyilvános cím: loopback, privát, link-local, többesküldéses, nem útválasztható. */
    static boolean isInternal(InetAddress a) {
        if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress()
            || a.isSiteLocalAddress() || a.isMulticastAddress()) {
            return true;
        }
        byte[] b = a.getAddress();
        if (b.length == 4) {
            int first = b[0] & 0xFF;
            int second = b[1] & 0xFF;
            // 0.0.0.0/8, megosztott címtér (CGNAT) 100.64.0.0/10, tesztcímek és fenntartott/broadcast tartományok
            return first == 0
                || (first == 100 && second >= 64 && second <= 127)
                || (first == 192 && second == 0 && (b[2] & 0xFF) == 0)
                || (first == 198 && (second == 18 || second == 19))
                || first >= 240;
        }
        // IPv6 egyedi helyi címek: fc00::/7
        return (b[0] & 0xFE) == 0xFC;
    }
}
