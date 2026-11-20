package io.tickoff.ratelimit;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.LongSupplier;

/**
 * Memóriabeli token bucket kérésszám-korlátozó. Minden kulcshoz (pl. "ip:1.2.3.4") külön vödör tartozik,
 * ami {@code capacity} tokennel indul, és percenként {@code refillPerMinute} tokennel töltődik vissza.
 *
 * <p>A kulcsok száma korlátos (LRU): ha túl sok különböző kulcs érkezik, a legrégebben használt vödrök
 * kiesnek, így nem lehet a memóriát kulcsok tömeges generálásával elfogyasztani.
 *
 * <p>Egyetlen példányra működik. Több példányos telepítésnél a vödröket közös tárolóba (pl. Redis) kell tenni.
 */
public class RateLimiter {

    /** Egy korlát: a név a kulcs része, így a különböző korlátok vödrei nem keverednek. */
    public record Limit(String name, int capacity, int refillPerMinute) {
        public Limit {
            if (capacity < 1 || refillPerMinute < 1) {
                throw new IllegalArgumentException("A kapacitás és a feltöltés pozitív kell legyen");
            }
        }
    }

    private static final class Bucket {
        double tokens;
        long lastNanos;

        Bucket(double tokens, long lastNanos) {
            this.tokens = tokens;
            this.lastNanos = lastNanos;
        }
    }

    private final Map<String, Bucket> buckets;
    private final LongSupplier nanoClock;

    public RateLimiter(int maxKeys) {
        this(maxKeys, System::nanoTime);
    }

    /** Tesztelhetőség: az idő forrása cserélhető. */
    public RateLimiter(int maxKeys, LongSupplier nanoClock) {
        this.nanoClock = nanoClock;
        this.buckets = Collections.synchronizedMap(new LinkedHashMap<>(256, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Bucket> eldest) {
                return size() > maxKeys;
            }
        });
    }

    /**
     * Megpróbál egy tokent elhasználni.
     *
     * @return 0, ha a kérés mehet; különben hány másodperc múlva lesz újra token (legalább 1)
     */
    public long tryAcquire(String id, Limit limit) {
        String key = limit.name() + ":" + id;
        long now = nanoClock.getAsLong();
        double perSecond = limit.refillPerMinute() / 60.0;

        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket(limit.capacity(), now));
        synchronized (bucket) {
            double elapsedSeconds = Math.max(0, now - bucket.lastNanos) / 1_000_000_000.0;
            bucket.tokens = Math.min(limit.capacity(), bucket.tokens + elapsedSeconds * perSecond);
            bucket.lastNanos = now;

            if (bucket.tokens >= 1) {
                bucket.tokens -= 1;
                return 0;
            }
            return Math.max(1, (long) Math.ceil((1 - bucket.tokens) / perSecond));
        }
    }

    int size() {
        return buckets.size();
    }
}
