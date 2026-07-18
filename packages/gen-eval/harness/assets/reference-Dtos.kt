package com.example.api.dto

import com.example.api.serde.MoneyStringDeserializer
import com.example.api.serde.MoneyStringSerializer
import com.fasterxml.jackson.annotation.JsonEnumDefaultValue
import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.fasterxml.jackson.databind.annotation.JsonDeserialize
import com.fasterxml.jackson.databind.annotation.JsonSerialize
import java.math.BigDecimal
import java.time.OffsetDateTime

/**
 * DTOs exchanged over the wire. Jackson (via jackson-module-kotlin)
 * serializes these to JSON and reconstructs them from request bodies.
 *
 * Kept deliberately separate from the server/controller code. Field-level
 * wire concerns live here as annotations; cross-cutting policy lives once in
 * [com.example.api.config.JacksonConfig].
 */

// ---- Enum with a forward-compatible default -----------------------------

/**
 * The species of a [Pet]. Idiomatic UPPER_CASE constants; `@JsonProperty`
 * pins the lower-case wire value on each.
 */
enum class PetType {
    @JsonProperty("cat")
    CAT,

    @JsonProperty("dog")
    DOG,

    @JsonProperty("parrot")
    PARROT,

    /**
     * Fallback for wire values this client doesn't model yet. Paired with
     * `READ_UNKNOWN_ENUM_VALUES_USING_DEFAULT_VALUE` on the ObjectMapper, so a
     * new server-side species deserializes here instead of throwing.
     */
    @JsonEnumDefaultValue
    @JsonProperty("unknown")
    UNKNOWN,
}

// ---- Polymorphism (OpenAPI oneOf + discriminator) -----------------------

/**
 * A contact method, discriminated on the `kind` wire property. Modeled as a
 * Kotlin `sealed interface` so the `when` over subtypes is exhaustive; Jackson
 * writes/reads the `kind` tag via `@JsonTypeInfo` + `@JsonSubTypes`.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(value = EmailContact::class, name = "email"),
    JsonSubTypes.Type(value = PhoneContact::class, name = "phone"),
)

sealed interface Contact

data class EmailContact(val email: String) : Contact

data class PhoneContact(val phone: String) : Contact

// ---- Aggregates ---------------------------------------------------------

data class Pet(
    val id: Int,
    val name: String,
    val type: PetType,
    /**
     * Custom (de)serializer: money crosses the wire as a fixed-scale decimal
     * string (e.g. `"49.99"`) to avoid binary-float rounding.
     */
    @JsonSerialize(using = MoneyStringSerializer::class)
    @JsonDeserialize(using = MoneyStringDeserializer::class)
    val adoptionFee: BigDecimal,
)

data class Person(
    /** Server-assigned; a client-supplied value is ignored (read-only). */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    val id: Int? = null,
    val name: String,
    val pet: Pet,
    val contact: Contact,
    /** Server-assigned timestamp, serialized as an ISO-8601 string (read-only). */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ssXXX")
    val createdAt: OffsetDateTime? = null,
    /** Accepted on input, never serialized back (write-only). */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    val password: String? = null,
    /** Free-form string attributes (OpenAPI `additionalProperties`). */
    val attributes: Map<String, String> = emptyMap(),
)
