FROM eclipse-temurin:18-jdk-alpine
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 5000
ENTRYPOINT ["java", "-jar", "app.jar"]
