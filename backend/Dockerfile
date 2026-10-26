# Bygger backend til et lite bilde for drift (Railway). Bygges fra backend/-mappen.
# Testene kjøres i CI før utrulling, så de hoppes over her.

FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
# Gradle og avhengigheter først, så de mellomlagres når bare koden endres.
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY src src
RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 liftyard
COPY --from=build /app/build/libs/*.jar app.jar
USER liftyard
# Bruk det meste av minnet containeren får, og start på nytt i stedet for å henge ved tomt minne.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
