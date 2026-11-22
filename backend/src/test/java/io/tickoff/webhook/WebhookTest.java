package io.tickoff.webhook;

import org.junit.jupiter.api.Test;

import java.net.InetAddress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A webhook biztonsági szabályai (SSRF ellen) és a tartalom előállítása. */
class WebhookTest {

    private static InetAddress ip(String literal) throws Exception {
        return InetAddress.getByName(literal); // IP-literál: nincs DNS-feloldás
    }

    @Test
    void internalAddressesAreRecognised() throws Exception {
        for (String a : new String[] {"127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254",
            "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255", "::1", "fe80::1", "fc00::1", "fd12:3456::1"}) {
            assertThat(WebhookUrls.isInternal(ip(a))).as(a).isTrue();
        }
    }

    @Test
    void publicAddressesAreAllowed() throws Exception {
        for (String a : new String[] {"8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"}) {
            assertThat(WebhookUrls.isInternal(ip(a))).as(a).isFalse();
        }
    }

    @Test
    void onlyPublicHttpsUrlsAreAccepted() {
        assertThat(WebhookUrls.validate("https://8.8.8.8/hook", false).getHost()).isEqualTo("8.8.8.8");

        assertThatThrownBy(() -> WebhookUrls.validate("http://8.8.8.8/hook", false)).hasMessageContaining("https");
        assertThatThrownBy(() -> WebhookUrls.validate("https://127.0.0.1/hook", false)).hasMessageContaining("belső");
        assertThatThrownBy(() -> WebhookUrls.validate("https://169.254.169.254/latest", false)).hasMessageContaining("belső");
        assertThatThrownBy(() -> WebhookUrls.validate("https://user:pw@8.8.8.8/", false)).hasMessageContaining("jelszó");
        assertThatThrownBy(() -> WebhookUrls.validate("ftp://8.8.8.8/", false)).hasMessageContaining("https");
        assertThatThrownBy(() -> WebhookUrls.validate("nem url", false)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void developmentModeAllowsLocalHttp() {
        assertThat(WebhookUrls.validate("http://127.0.0.1:9000/hook", true).getPort()).isEqualTo(9000);
    }

    @Test
    void jsonStringsAreEscaped() {
        assertThat(WebhookService.quote("a\"b\\c\nd\te")).isEqualTo("\"a\\\"b\\\\c\\nd\\te\"");
        assertThat(WebhookService.quote("\u0001")).isEqualTo("\"\\u0001\"");
        // Az ékezetek érintetlenek maradnak
        assertThat(WebhookService.quote("Kávé")).isEqualTo("\"Kávé\"");
    }

    @Test
    void signatureIsAStableHmac() throws Exception {
        // RFC 4231 4.2. teszt-vektor mintájára: a kulcs és az adat ismert, az eredmény determinisztikus
        String a = WebhookSender.sign("titok", "{\"x\":1}");
        assertThat(a).hasSize(64).matches("[0-9a-f]{64}");
        assertThat(WebhookSender.sign("titok", "{\"x\":1}")).isEqualTo(a);
        assertThat(WebhookSender.sign("masik", "{\"x\":1}")).isNotEqualTo(a);
        assertThat(WebhookSender.sign("titok", "{\"x\":2}")).isNotEqualTo(a);
    }
}
