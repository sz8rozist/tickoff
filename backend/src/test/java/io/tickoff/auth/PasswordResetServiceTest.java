package io.tickoff.auth;

import io.tickoff.domain.PasswordResetToken;
import io.tickoff.domain.PasswordResetTokenRepository;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.mail.MailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PasswordResetServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-20T12:00:00Z");

    private final UserRepository users = mock(UserRepository.class);
    private final PasswordResetTokenRepository tokens = mock(PasswordResetTokenRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final MailService mail = mock(MailService.class);
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final User user = new User("anna@example.com", "old-hash", "Anna");
    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        when(mail.isEnabled()).thenReturn(true);
        when(users.findByEmail("anna@example.com")).thenReturn(Optional.of(user));
        when(encoder.encode("uj-jelszo-123")).thenReturn("new-hash");
        service = new PasswordResetService(users, tokens, encoder, mail, clock, "https://app.example.com/");
    }

    @Test
    void unknownEmailSendsNothingAndSavesNothing() {
        service.requestReset("nincs@example.com");

        verify(mail, never()).send(anyString(), anyString(), anyString());
        verify(tokens, never()).save(any());
    }

    @Test
    void nothingHappensWhenMailIsNotConfigured() {
        when(mail.isEnabled()).thenReturn(false);

        service.requestReset("anna@example.com");

        verify(tokens, never()).save(any());
        verify(mail, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void emailMatchingIsCaseInsensitiveAndTrimmed() {
        service.requestReset("  ANNA@Example.com ");

        verify(mail).send(anyString(), anyString(), anyString());
    }

    @Test
    void linkContainsTheRawTokenButOnlyItsHashIsStored() {
        service.requestReset("anna@example.com");

        ArgumentCaptor<PasswordResetToken> saved = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokens).save(saved.capture());
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mail).send(anyString(), anyString(), body.capture());

        String link = body.getValue().lines().filter(l -> l.startsWith("https://")).findFirst().orElseThrow();
        assertThat(link).startsWith("https://app.example.com/?reset-token=");
        String rawToken = link.substring(link.indexOf('=') + 1);
        assertThat(rawToken).hasSizeGreaterThanOrEqualTo(40).doesNotContain("=");

        // A hash illik a tokenre, de a nyers token nincs eltárolva (csak az 1 órás lejárat)
        PasswordResetToken token = saved.getValue();
        assertThat(token.isUsable(NOW)).isTrue();
        assertThat(token.isUsable(NOW.plusSeconds(3600))).isFalse();
        // A korábbi, fel nem használt linkek érvénytelenek, de a sorok nem törlődnek (a korlát számlálásához kellenek)
        verify(tokens).invalidateUnusedByUserId(user.getId(), NOW);
        verify(tokens, never()).delete(any(PasswordResetToken.class));
    }

    @Test
    void atMostThreeRequestsPerHourPerAccount() {
        when(tokens.countByUserIdAndCreatedAtAfter(any(), any())).thenReturn(3L);

        service.requestReset("anna@example.com");

        verify(mail, never()).send(anyString(), anyString(), anyString());
        verify(tokens, never()).save(any());
    }

    @Test
    void validTokenSetsPasswordMarksChangeTimeAndIsSingleUse() {
        PasswordResetToken token = new PasswordResetToken(user, PasswordResetService.hash("RAW"), NOW.plusSeconds(600));
        when(tokens.findByTokenHashWithUser(PasswordResetService.hash("RAW"))).thenReturn(Optional.of(token));

        assertThat(service.reset("RAW", "uj-jelszo-123")).isTrue();

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        // A jelszócsere ideje alapján érvénytelenednek a régi bejelentkezések
        assertThat(user.getPasswordChangedAt()).isEqualTo(NOW);
        assertThat(token.getUsedAt()).isEqualTo(NOW);
        verify(tokens, times(1)).invalidateUnusedByUserId(any(), eq(NOW));

        // Másodszor ugyanazzal a tokennel már nem megy
        assertThat(service.reset("RAW", "masik-jelszo-1")).isFalse();
        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
    }

    @Test
    void unknownExpiredOrUsedTokenIsRejected() {
        when(tokens.findByTokenHashWithUser(PasswordResetService.hash("NINCS"))).thenReturn(Optional.empty());
        assertThat(service.reset("NINCS", "uj-jelszo-123")).isFalse();

        PasswordResetToken expired = new PasswordResetToken(user, PasswordResetService.hash("LEJART"), NOW.minusSeconds(1));
        when(tokens.findByTokenHashWithUser(PasswordResetService.hash("LEJART"))).thenReturn(Optional.of(expired));
        assertThat(service.reset("LEJART", "uj-jelszo-123")).isFalse();

        PasswordResetToken used = new PasswordResetToken(user, PasswordResetService.hash("HASZNALT"), NOW.plusSeconds(600));
        used.markUsed(NOW.minusSeconds(60));
        when(tokens.findByTokenHashWithUser(PasswordResetService.hash("HASZNALT"))).thenReturn(Optional.of(used));
        assertThat(service.reset("HASZNALT", "uj-jelszo-123")).isFalse();

        assertThat(user.getPasswordHash()).isEqualTo("old-hash");
        assertThat(user.getPasswordChangedAt()).isNull();
    }
}
