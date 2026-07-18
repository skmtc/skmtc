package com.example.api.config

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.SerializationFeature
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * Global Jackson policy — the cross-cutting decisions that have no per-field
 * home. Everything field-specific lives as an annotation on the DTO instead
 * (see [com.example.api.dto]). For a generator, this is the one file emitted
 * once per project; the DTO annotations are emitted per-field.
 */
@Configuration
class JacksonConfig {

    @Bean
    fun jacksonCustomizer(): Jackson2ObjectMapperBuilderCustomizer =
        Jackson2ObjectMapperBuilderCustomizer { builder ->
            // Forward-compat: don't fail when the payload carries fields we
            // don't model yet, and render dates as ISO-8601 strings not epochs.
            builder.featuresToDisable(
                DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                SerializationFeature.WRITE_DATES_AS_TIMESTAMPS,
            )
            // Unknown enum values fall back to @JsonEnumDefaultValue (PetType.UNKNOWN).
            builder.featuresToEnable(
                DeserializationFeature.READ_UNKNOWN_ENUM_VALUES_USING_DEFAULT_VALUE,
            )
            // Omit null fields (e.g. the write-only password) from responses.
            builder.serializationInclusion(JsonInclude.Include.NON_NULL)
            // JavaTimeModule is auto-registered by Spring Boot (jackson-datatype-jsr310
            // ships with starter-web), so OffsetDateTime serializes without extra wiring.
        }
}
