# --- build ---
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q dependency:go-offline
COPY src src
RUN ./mvnw -q -DskipTests package

# --- run ---
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/backend-*.jar app.jar

# Nem root felhasználóval futunk. A képernyőképek könyvtárát ő birtokolja; üres, új kötet (volume) az image-ből
# örökli a tulajdonost. Egy korábban rootként létrehozott kötetnél: chown -R 10001:10001 a kötet tartalmán.
RUN useradd --system --uid 10001 --no-create-home tickoff \
    && mkdir -p /data/screenshots \
    && chown -R tickoff:tickoff /data
USER tickoff

EXPOSE 8080
# A konténer memóriakorlátjához igazítja a heap-et
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
