package io.tickoff.ratelimit;

import io.tickoff.ratelimit.RateLimiter.Limit;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RateLimiterTest {

    private static final long SECOND = 1_000_000_000L;

    private final AtomicLong clock = new AtomicLong(1_000 * SECOND);
    private final RateLimiter limiter = new RateLimiter(100, clock::get);

    @Test
    void allowsUpToCapacityThenRejects() {
        Limit limit = new Limit("t", 3, 60);
        assertThat(limiter.tryAcquire("a", limit)).isZero();
        assertThat(limiter.tryAcquire("a", limit)).isZero();
        assertThat(limiter.tryAcquire("a", limit)).isZero();
        assertThat(limiter.tryAcquire("a", limit)).isPositive();
    }

    @Test
    void retryAfterTellsWhenTheNextTokenArrives() {
        // 6 token/perc = 1 token / 10 mp
        Limit limit = new Limit("t", 1, 6);
        assertThat(limiter.tryAcquire("a", limit)).isZero();
        assertThat(limiter.tryAcquire("a", limit)).isEqualTo(10);

        clock.addAndGet(4 * SECOND);
        assertThat(limiter.tryAcquire("a", limit)).isEqualTo(6);
    }

    @Test
    void refillsOverTime() {
        Limit limit = new Limit("t", 2, 60); // 1 token / mp
        limiter.tryAcquire("a", limit);
        limiter.tryAcquire("a", limit);
        assertThat(limiter.tryAcquire("a", limit)).isPositive();

        clock.addAndGet(SECOND);
        assertThat(limiter.tryAcquire("a", limit)).isZero();
        assertThat(limiter.tryAcquire("a", limit)).isPositive();
    }

    @Test
    void neverRefillsAboveCapacity() {
        Limit limit = new Limit("t", 2, 60);
        limiter.tryAcquire("a", limit);

        clock.addAndGet(3600 * SECOND); // egy óra tétlenség után is csak a kapacitásnyi token van
        assertThat(limiter.tryAcquire("a", limit)).isZero();
        assertThat(limiter.tryAcquire("a", limit)).isZero();
        assertThat(limiter.tryAcquire("a", limit)).isPositive();
    }

    @Test
    void keysAndLimitNamesAreIndependent() {
        Limit one = new Limit("one", 1, 1);
        Limit two = new Limit("two", 1, 1);

        assertThat(limiter.tryAcquire("a", one)).isZero();
        assertThat(limiter.tryAcquire("a", one)).isPositive();

        assertThat(limiter.tryAcquire("b", one)).isZero();   // másik kulcs
        assertThat(limiter.tryAcquire("a", two)).isZero();   // másik korlát ugyanazzal a kulccsal
    }

    @Test
    void numberOfTrackedKeysIsBounded() {
        RateLimiter small = new RateLimiter(3, clock::get);
        Limit limit = new Limit("t", 1, 1);
        for (int i = 0; i < 50; i++) {
            small.tryAcquire("k" + i, limit);
        }
        assertThat(small.size()).isLessThanOrEqualTo(3);
    }

    @Test
    void rejectsNonPositiveLimits() {
        assertThatThrownBy(() -> new Limit("t", 0, 10)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Limit("t", 10, 0)).isInstanceOf(IllegalArgumentException.class);
    }
}
