plugins {
    kotlin("jvm") version "2.2.20"
    kotlin("plugin.spring") version "2.2.20"
    id("org.springframework.boot") version "3.5.0"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    // starter-web brings in Jackson (spring-boot-starter-json) by default,
    // which serializes/deserializes the DTOs to/from JSON.
    implementation("org.springframework.boot:spring-boot-starter-web")
    // Jackson's Kotlin module: data-class construction, nullability, defaults.
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    // Spring MVC's Kotlin parameter handling requires kotlin-reflect.
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    // The pinned DTO contract test (JUnit 5 + assertions).
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

kotlin {
    jvmToolchain(21)
}

tasks.test {
    useJUnitPlatform()
}
