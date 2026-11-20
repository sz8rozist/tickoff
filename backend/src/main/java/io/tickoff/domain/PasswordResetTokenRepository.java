package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /** A token betöltése a felhasználóval együtt (az új jelszó beállításához). */
    @Query("select t from PasswordResetToken t join fetch t.user where t.tokenHash = :hash")
    Optional<PasswordResetToken> findByTokenHashWithUser(@Param("hash") String hash);

    /** Ennyi visszaállító levelet kért a felhasználó az adott időpont óta (levélbombázás ellen). */
    long countByUserIdAndCreatedAtAfter(Long userId, Instant since);

    /**
     * A felhasználó többi, még fel nem használt tokenjét érvényteleníti (új kérés vagy sikeres visszaállítás után).
     * Szándékosan nem törli a sorokat: a kérések számlálásához (óránkénti korlát) szükségesek.
     */
    @Modifying
    @Query("update PasswordResetToken t set t.usedAt = :now where t.user.id = :userId and t.usedAt is null")
    void invalidateUnusedByUserId(@Param("userId") Long userId, @Param("now") Instant now);

    /** A régi tokenek takarítása (a számláláshoz egy óra elég, ennél jóval régebbi sorra nincs szükség). */
    @Modifying
    @Query("delete from PasswordResetToken t where t.createdAt < :before")
    void deleteOlderThan(@Param("before") Instant before);
}
