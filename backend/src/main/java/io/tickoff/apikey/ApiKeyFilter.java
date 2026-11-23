package io.tickoff.apikey;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;

/**
 * Az {@code /api/v1/**} végpontokon az {@code Authorization: Bearer tk_…} fejlécű kérést API-kulccsal hitelesíti: a
 * kulcs tulajdonosaként fut tovább (a projekt-hozzáférés ugyanúgy a tulajdonos szerepkörén múlik). Más útvonalon
 * az API-kulcs nem fogadható el (a {@code tk_} tokent az erőforrás-szerver sem próbálja JWT-ként értelmezni).
 */
public class ApiKeyFilter extends OncePerRequestFilter {

    static final String PATH_PREFIX = "/api/v1/";

    private final ApiKeyService keys;

    public ApiKeyFilter(ApiKeyService keys) {
        this.keys = keys;
    }

    /** Az API-kulcsot hordozó kérés: a Bearer token {@code tk_} előtagú. */
    public static boolean isApiKeyRequest(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        return header != null && header.startsWith("Bearer " + ApiKeyService.PREFIX);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(PATH_PREFIX) || !isApiKeyRequest(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String key = request.getHeader("Authorization").substring("Bearer ".length()).trim();
        Optional<Long> userId = keys.authenticate(key);
        if (userId.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getOutputStream().write("{\"error\":\"invalid_api_key\"}".getBytes(StandardCharsets.UTF_8));
            return;
        }
        // Szintetikus JWT, hogy a meglévő hozzáférés-ellenőrzés (a subject a felhasználó azonosítója) változtatás nélkül működjön
        Jwt jwt = Jwt.withTokenValue("api-key")
            .header("alg", "none")
            .subject(String.valueOf(userId.get()))
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new JwtAuthenticationToken(jwt, java.util.List.of()));
        SecurityContextHolder.setContext(context);
        chain.doFilter(request, response);
    }
}
