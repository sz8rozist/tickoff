package io.tickoff.config;

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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                // Hibaoldal: enélkül minden 4xx hiba (pl. 400, 409) 401-re íródna át
                .requestMatchers("/error").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
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

    /**
     * A dashboard eredetét engedjük. A widget idegen domainekről hív, ezért annak
     * projektenkénti origin-ellenőrzését a widget controllerben kell megoldani.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${tickoff.dashboard-origin}") String dashboardOrigin) {
        CorsConfiguration dashboard = new CorsConfiguration();
        dashboard.setAllowedOrigins(List.of(dashboardOrigin));
        dashboard.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        dashboard.setAllowedHeaders(List.of("*"));
        dashboard.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", dashboard);
        return source;
    }
}
