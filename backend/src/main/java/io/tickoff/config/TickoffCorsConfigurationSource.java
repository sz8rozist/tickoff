package io.tickoff.config;

import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.widget.Origins;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

/**
 * Két külön CORS-szabály:
 * <ul>
 *   <li>{@code /api/widget/{token}/**}: csak annak az oldalnak az origin-je engedélyezett, amelyik a tokenhez
 *       tartozó projektben szerepel. Ismeretlen token esetén nincs CORS-fejléc, a böngésző blokkolja a hívást.</li>
 *   <li>többi {@code /api/**}: a dashboard origin-je, sütik nélkül is használható (JWT a fejlécben).</li>
 * </ul>
 * Az útvonal tartalmazza a tokent, mert a preflight (OPTIONS) kérés nem hordozhat egyedi fejléc-értéket.
 */
public class TickoffCorsConfigurationSource implements CorsConfigurationSource {

    private static final String WIDGET_PREFIX = "/api/widget/";

    private final ProjectRepository projects;
    private final String dashboardOrigin;

    public TickoffCorsConfigurationSource(ProjectRepository projects, String dashboardOrigin) {
        this.projects = projects;
        this.dashboardOrigin = dashboardOrigin;
    }

    @Override
    public CorsConfiguration getCorsConfiguration(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.startsWith(WIDGET_PREFIX)) {
            return widgetConfiguration(path.substring(WIDGET_PREFIX.length()));
        }
        if (path.startsWith("/api/")) {
            CorsConfiguration cfg = new CorsConfiguration();
            cfg.setAllowedOrigins(List.of(dashboardOrigin));
            cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
            cfg.setAllowedHeaders(List.of("*"));
            return cfg;
        }
        return null;
    }

    private CorsConfiguration widgetConfiguration(String rest) {
        int slash = rest.indexOf('/');
        String token = slash < 0 ? rest : rest.substring(0, slash);
        if (token.isEmpty()) return null;
        String origin = projects.findByShareToken(token).map(Project::getSiteUrl).map(Origins::of).orElse(null);
        if (origin == null) return null;

        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of(origin));
        cfg.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Content-Type"));
        cfg.setMaxAge(3600L);
        return cfg;
    }
}
