package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    java.util.List<User> findByDigestFrequencyNot(String digestFrequency);

    Optional<User> findByEmailVerifyHash(String emailVerifyHash);

    Optional<User> findByEmail(String email);
}
