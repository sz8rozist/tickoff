package io.tickoff.auth;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;

/**
 * Időalapú egyszer használatos kódok (TOTP, RFC 6238): HMAC-SHA1, 30 másodperces időszelet, 6 jegyű kód. Az
 * authenticator alkalmazások (Google Authenticator, Authy, 1Password stb.) ezt a változatot használják.
 */
public final class Totp {

    static final int STEP_SECONDS = 30;
    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {
    }

    /** Új véletlen titok (160 bit), base32-ben. */
    public static String newSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return base32(bytes);
    }

    /** A 6 jegyű kód az adott időszeletre. */
    public static String code(String base32Secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(decode(base32Secret), "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7F) << 24) | ((hash[offset + 1] & 0xFF) << 16)
                | ((hash[offset + 2] & 0xFF) << 8) | (hash[offset + 3] & 0xFF);
            return String.format("%06d", binary % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Ellenőrzi a kódot az aktuális és a szomszédos időszeletre (±1: az órák kis eltérése miatt). A találat
     * időszeletét adja vissza, vagy -1-et, ha nincs egyezés.
     */
    public static long verify(String base32Secret, String candidate, long nowMillis) {
        if (candidate == null || !candidate.matches("\\d{6}")) return -1;
        long current = nowMillis / 1000 / STEP_SECONDS;
        for (long step = current - 1; step <= current + 1; step++) {
            if (constantTimeEquals(code(base32Secret, step), candidate)) return step;
        }
        return -1;
    }

    /** Az authenticator alkalmazás számára beolvasható cím (QR-kódba kerül). */
    public static String otpauthUri(String issuer, String account, String base32Secret) {
        return "otpauth://totp/" + java.net.URLEncoder.encode(issuer + ":" + account, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20")
            + "?secret=" + base32Secret + "&issuer=" + java.net.URLEncoder.encode(issuer, java.nio.charset.StandardCharsets.UTF_8)
            + "&algorithm=SHA1&digits=6&period=" + STEP_SECONDS;
    }

    static String base32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bits += 8;
            while (bits >= 5) {
                out.append(BASE32.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) out.append(BASE32.charAt((buffer << (5 - bits)) & 31));
        return out.toString();
    }

    static byte[] decode(String s) {
        String clean = s.replace("=", "").replace(" ", "").toUpperCase();
        byte[] out = new byte[clean.length() * 5 / 8];
        int buffer = 0;
        int bits = 0;
        int index = 0;
        for (char c : clean.toCharArray()) {
            int v = BASE32.indexOf(c);
            if (v < 0) throw new IllegalArgumentException("Érvénytelen base32 karakter");
            buffer = (buffer << 5) | v;
            bits += 5;
            if (bits >= 8) {
                out[index++] = (byte) ((buffer >> (bits - 8)) & 0xFF);
                bits -= 8;
            }
        }
        return out;
    }

    private static boolean constantTimeEquals(String a, String b) {
        return java.security.MessageDigest.isEqual(
            a.getBytes(java.nio.charset.StandardCharsets.UTF_8), b.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
