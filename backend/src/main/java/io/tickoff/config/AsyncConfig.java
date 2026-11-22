package io.tickoff.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.time.Clock;
import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    private static final Logger log = LoggerFactory.getLogger(AsyncConfig.class);

    /**
     * Az e-mailek küldéséhez. Kicsi, korlátos: ha az SMTP-szerver lassú vagy elérhetetlen, a várakozó levelek
     * száma korlátos marad (a túlcsorduló levelet eldobjuk és naplózzuk), így nem fogy el a memória és a szálak.
     */
    @Bean("mailExecutor")
    Executor mailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("mail-");
        executor.setRejectedExecutionHandler((task, pool) -> log.warn("Az e-mail-sor megtelt, egy levél elmaradt."));
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        return executor;
    }

    /** A webhook-kézbesítéshez: ugyanilyen korlátos sor, a lassú fogadó ne tudja kimeríteni a szálakat. */
    @Bean("webhookExecutor")
    Executor webhookExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("webhook-");
        executor.setRejectedExecutionHandler((task, pool) -> log.warn("A webhook-sor megtelt, egy esemény elmaradt."));
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        return executor;
    }

    /** Az idő forrása; tesztben cserélhető. */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
