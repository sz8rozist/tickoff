package io.tickoff.ratelimit;

import io.tickoff.ratelimit.RateLimiter.Limit;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.server.PathContainer;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Kérésszám-korlátozás útvonal-szabályok alapján. Az első egyező szabály érvényes; a szabály korlátai
 * közül bármelyik túllépése {@code 429 Too Many Requests}-et ad {@code Retry-After} fejléccel.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    /** Mihez kötjük a korlátot: a kliens IP-címéhez vagy a widget tokenjéhez (az útvonalból). */
    public enum Scope { IP, TOKEN }

    public record Scoped(Scope scope, Limit limit) {
    }

    /** {@code method == null}: minden metódusra (az OPTIONS-ra is) érvényes. */
    public record Rule(HttpMethod method, String pattern, List<Scoped> limits) {
        public static Rule of(HttpMethod method, String pattern, Scoped... limits) {
            return new Rule(method, pattern, List.of(limits));
        }
    }

    private record Compiled(HttpMethod method, PathPattern pattern, List<Scoped> limits) {
    }

    private final RateLimiter limiter;
    private final List<Compiled> rules;

    /**
     * @param name egyedi név: a OncePerRequestFilter ez alapján jegyzi meg, hogy a szűrő már lefutott. Azonos
     *             osztályú, de különböző nevű példányok így mindketten lefutnak ugyanazon a kérésen.
     */
    public RateLimitFilter(String name, RateLimiter limiter, List<Rule> rules) {
        setBeanName(name);
        this.limiter = limiter;
        PathPatternParser parser = PathPatternParser.defaultInstance;
        // Az IP-korlátokat vizsgáljuk először: így egy kliens nem tud korlátlan számú token-kulcsot létrehozni.
        this.rules = rules.stream()
            .map(r -> new Compiled(r.method(), parser.parse(r.pattern()),
                r.limits().stream().sorted((a, b) -> a.scope().compareTo(b.scope())).toList()))
            .toList();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        PathContainer path = PathContainer.parsePath(request.getRequestURI());
        String ip = request.getRemoteAddr();

        for (Compiled rule : rules) {
            if (rule.method() != null && !rule.method().matches(request.getMethod())) continue;
            PathPattern.PathMatchInfo match = rule.pattern().matchAndExtract(path);
            if (match == null) continue;

            for (Scoped s : rule.limits()) {
                String id = s.scope() == Scope.IP ? ip : tokenOf(match);
                if (id == null) continue;
                long retryAfter = limiter.tryAcquire(id, s.limit());
                if (retryAfter > 0) {
                    reject(response, retryAfter);
                    return;
                }
            }
            break; // csak az első egyező szabály érvényes
        }
        chain.doFilter(request, response);
    }

    private static String tokenOf(PathPattern.PathMatchInfo match) {
        Map<String, String> vars = match.getUriVariables();
        return vars.get("token");
    }

    private static void reject(HttpServletResponse response, long retryAfterSeconds) throws IOException {
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\"}");
    }
}
