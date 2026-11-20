package io.tickoff.mail;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MailServiceTest {

    @Test
    void subjectCannotCarryHeaderInjection() {
        // A projektnév a felhasználótól jön, a tárgyba kerül: a sortörés új fejlécet nyithatna
        assertThat(MailService.singleLine("Új visszajelzés: Kávézó\r\nBcc: aki@example.com"))
            .isEqualTo("Új visszajelzés: Kávézó Bcc: aki@example.com")
            .doesNotContain("\n")
            .doesNotContain("\r");
        assertThat(MailService.singleLine("  egyszerű tárgy  ")).isEqualTo("egyszerű tárgy");
    }
}
