package io.tickoff.ratelimit;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private static final String TOKEN = "abc123";

    private final AtomicInteger reached = new AtomicInteger();
    private final FilterChain chain = (req, res) -> reached.incrementAndGet();

    private MockHttpServletResponse call(RateLimitFilter filter, String method, String uri, String ip) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        req.setRemoteAddr(ip);
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, chain);
        return res;
    }

    @Test
    void loginIsLimitedPerIpAndAnswers429WithRetryAfter() throws Exception {
        RateLimitFilter filter = RateLimits.afterCors();

        for (int i = 0; i < 10; i++) {
            assertThat(call(filter, "POST", "/api/auth/login", "1.1.1.1").getStatus()).isEqualTo(200);
        }
        int reachedBefore = reached.get();

        MockHttpServletResponse blocked = call(filter, "POST", "/api/auth/login", "1.1.1.1");
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(Long.parseLong(blocked.getHeader("Retry-After"))).isPositive();
        assertThat(blocked.getContentType()).startsWith("application/json");
        assertThat(blocked.getContentAsString()).contains("\"status\":429");
        assertThat(reached.get()).as("a korlátozott kérés nem érheti el a láncot").isEqualTo(reachedBefore);

        // másik IP-t nem érint
        assertThat(call(filter, "POST", "/api/auth/login", "2.2.2.2").getStatus()).isEqualTo(200);
    }

    @Test
    void accountDeletionIsLimitedPerIp() throws Exception {
        RateLimitFilter filter = RateLimits.afterCors();

        for (int i = 0; i < 5; i++) {
            assertThat(call(filter, "DELETE", "/api/me", "7.7.7.7").getStatus()).isEqualTo(200);
        }
        assertThat(call(filter, "DELETE", "/api/me", "7.7.7.7").getStatus()).isEqualTo(429);

        // a GET /api/me (bejelentkezés-ellenőrzés) nincs korlátozva
        assertThat(call(filter, "GET", "/api/me", "7.7.7.7").getStatus()).isEqualTo(200);
    }

    @Test
    void invitingMembersIsLimitedPerIp() throws Exception {
        RateLimitFilter filter = RateLimits.afterCors();

        for (int i = 0; i < 20; i++) {
            assertThat(call(filter, "POST", "/api/projects/" + i + "/members", "8.8.8.8").getStatus()).isEqualTo(200);
        }
        assertThat(call(filter, "POST", "/api/projects/5/members", "8.8.8.8").getStatus()).isEqualTo(429);
        // a tagok listázása és az eltávolítás nincs korlátozva
        assertThat(call(filter, "GET", "/api/projects/5/members", "8.8.8.8").getStatus()).isEqualTo(200);
        assertThat(call(filter, "DELETE", "/api/projects/5/members/7", "8.8.8.8").getStatus()).isEqualTo(200);
    }

    @Test
    void commentAndScreenshotShareTheWriteBudget() throws Exception {
        RateLimitFilter filter = RateLimits.afterCors();

        for (int i = 0; i < 10; i++) {
            assertThat(call(filter, "POST", "/api/widget/" + TOKEN + "/comments", "3.3.3.3").getStatus()).isEqualTo(200);
            assertThat(call(filter, "POST", "/api/widget/" + TOKEN + "/comments/" + i + "/screenshot", "3.3.3.3").getStatus())
                .isEqualTo(200);
        }
        // 20 írás elfogyott: mindkét útvonal tiltott
        assertThat(call(filter, "POST", "/api/widget/" + TOKEN + "/comments", "3.3.3.3").getStatus()).isEqualTo(429);
        assertThat(call(filter, "POST", "/api/widget/" + TOKEN + "/comments/1/screenshot", "3.3.3.3").getStatus())
            .isEqualTo(429);
        // a válaszok is ugyanebbe a keretbe tartoznak
        assertThat(call(filter, "POST", "/api/widget/" + TOKEN + "/comments/1/replies", "3.3.3.3").getStatus())
            .isEqualTo(429);

        // az olvasás külön keret, azt nem érinti
        assertThat(call(filter, "GET", "/api/widget/" + TOKEN + "/project", "3.3.3.3").getStatus()).isEqualTo(200);
    }

    @Test
    void tokenLimitHoldsEvenWhenRequestsComeFromManyIps() throws Exception {
        RateLimitFilter filter = RateLimits.afterCors();

        int allowed = 0;
        // 10 IP x 20 kérés: az IP-korlát egyiket sem állítja meg, a token-korlát (120) viszont igen
        for (int ip = 0; ip < 10; ip++) {
            for (int i = 0; i < 20; i++) {
                if (call(filter, "POST", "/api/widget/" + TOKEN + "/comments", "10.0.0." + ip).getStatus() == 200) {
                    allowed++;
                }
            }
        }
        assertThat(allowed).isEqualTo(120);

        // másik token nem érintett
        assertThat(call(filter, "POST", "/api/widget/masiktoken/comments", "10.0.1.1").getStatus()).isEqualTo(200);
    }

    @Test
    void preflightCountsTowardTheCoarseLimitBeforeCors() throws Exception {
        RateLimitFilter filter = RateLimits.beforeCors();

        for (int i = 0; i < 200; i++) {
            assertThat(call(filter, "OPTIONS", "/api/widget/" + TOKEN + "/comments", "4.4.4.4").getStatus()).isEqualTo(200);
        }
        assertThat(call(filter, "OPTIONS", "/api/widget/" + TOKEN + "/comments", "4.4.4.4").getStatus()).isEqualTo(429);
        assertThat(call(filter, "GET", "/api/widget/" + TOKEN + "/project", "4.4.4.4").getStatus()).isEqualTo(429);
    }

    @Test
    void otherEndpointsAreNeverLimited() throws Exception {
        RateLimitFilter after = RateLimits.afterCors();
        RateLimitFilter before = RateLimits.beforeCors();

        for (int i = 0; i < 500; i++) {
            assertThat(call(after, "GET", "/api/projects", "5.5.5.5").getStatus()).isEqualTo(200);
            assertThat(call(before, "GET", "/api/projects", "5.5.5.5").getStatus()).isEqualTo(200);
        }
    }

    @Test
    void bothFiltersRunOnTheSameRequest() throws Exception {
        // Azonos osztályú szűrők: a OncePerRequestFilter nem szoríthatja ki a másodikat (egyedi nevük van).
        RateLimitFilter before = RateLimits.beforeCors();
        RateLimitFilter after = RateLimits.afterCors();

        FilterChain both = (rq, rs) -> after.doFilter(rq, rs, chain);

        int ok = 0;
        for (int i = 0; i < 30; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/widget/" + TOKEN + "/comments");
            req.setRemoteAddr("6.6.6.6");
            MockHttpServletResponse res = new MockHttpServletResponse();
            before.doFilter(req, res, both);
            if (res.getStatus() == 200) ok++;
        }
        assertThat(ok).as("a második szűrő is lefutott: 20 írás után tilt").isEqualTo(20);
    }
}
