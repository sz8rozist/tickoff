package io.tickoff.config;

import io.tickoff.domain.ProjectRepository;
import io.tickoff.ratelimit.RateLimits;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;


@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http,
                                    @Value("${tickoff.rate-limit.enabled:true}") boolean rateLimitEnabled) throws Exception {
        if (rateLimitEnabled) {
            // A durva korlát a CORS előtt fut (a preflightot is védi), a pontos korlátok utána (a 429-es válasz
            // így már tartalmazza a CORS-fejléceket, és a widget el tudja olvasni).
            http.addFilterBefore(RateLimits.beforeCors(), CorsFilter.class)
                .addFilterAfter(RateLimits.afterCors(), CorsFilter.class);
        }
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                // Hibaoldal: enélkül minden 4xx hiba (pl. 400, 409) 401-re íródna át
                .requestMatchers("/error").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                // Leiratkozás az ügyfélnek küldött levélből: a link titka a kulcs
                .requestMatchers("/api/notifications/unsubscribe/**").permitAll()
                // Widget végpontok: tokennel védettek, a controller ellenőrzi
                .requestMatchers("/api/widget/**").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** A dashboardot és a widgetet külön CORS-szabály kezeli, lásd {@link TickoffCorsConfigurationSource}. */
    @Bean
    CorsConfigurationSource corsConfigurationSource(ProjectRepository projects,
                                                    @Value("${tickoff.dashboard-origin}") String dashboardOrigin) {
        return new TickoffCorsConfigurationSource(projects, dashboardOrigin);
    }
}
