package io.tickoff.apikey;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/** A saját API-kulcsok kezelése (csak bejelentkezéssel; API-kulccsal nem érhető el). */
@RestController
@RequestMapping("/api/me/api-keys")
public class ApiKeyController {

    public record CreateRequest(@NotBlank @Size(max = 80) String name) {
    }

    public record KeyDto(Long id, String name, String prefix, Instant createdAt, Instant lastUsedAt) {
        static KeyDto of(ApiKey k) {
            return new KeyDto(k.getId(), k.getName(), k.getPrefix(), k.getCreatedAt(), k.getLastUsedAt());
        }
    }

    /** A létrehozás válasza: a teljes kulcs csak itt látható, később nem kérhető le. */
    public record CreatedDto(Long id, String name, String prefix, Instant createdAt, String key) {
    }

    private final ApiKeyService service;
    private final ApiKeyRepository keys;

    public ApiKeyController(ApiKeyService service, ApiKeyRepository keys) {
        this.service = service;
        this.keys = keys;
    }

    @GetMapping
    public List<KeyDto> list(@AuthenticationPrincipal Jwt jwt) {
        return keys.findByUserIdOrderByIdDesc(Long.valueOf(jwt.getSubject())).stream().map(KeyDto::of).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateRequest req) {
        try {
            ApiKeyService.Created c = service.create(Long.valueOf(jwt.getSubject()), req.name());
            ApiKey k = c.entity();
            return new CreatedDto(k.getId(), k.getName(), k.getPrefix(), k.getCreatedAt(), c.key());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        ApiKey key = keys.findByIdAndUserId(id, Long.valueOf(jwt.getSubject()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        keys.delete(key);
    }
}
