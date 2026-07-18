package com.example.api.dto

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * The DTO wire contract — the acceptance spec for the generated
 * `com.example.api.dto.Dtos.kt`. Every case pins a behavior the reference
 * implementation exhibits; the generated DTOs must reproduce all of them.
 *
 * The mapper mirrors [com.example.api.config.JacksonConfig] (hand-built here
 * so the suite runs without a Spring context): unknown JSON fields tolerated,
 * unknown enum values fall back to `@JsonEnumDefaultValue`, dates as ISO
 * strings, nulls omitted from output.
 */
class DtoContractTest {

    private val mapper: ObjectMapper = jacksonObjectMapper()
        .registerModule(JavaTimeModule())
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .enable(DeserializationFeature.READ_UNKNOWN_ENUM_VALUES_USING_DEFAULT_VALUE)
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .setSerializationInclusion(JsonInclude.Include.NON_NULL)

    private fun pet(fee: String = "49.99") = Pet(
        id = 1,
        name = "Mittens",
        type = PetType.CAT,
        adoptionFee = BigDecimal(fee),
    )

    private fun person(contact: Contact = EmailContact(email = "ada@example.com")) = Person(
        name = "Ada",
        pet = pet(),
        contact = contact,
    )

    // ---- Money: fixed-scale decimal STRING on the wire ------------------

    @Test
    fun `money serializes as a two-decimal string`() {
        val json = mapper.readTree(mapper.writeValueAsString(pet()))
        assertTrue(json.get("adoptionFee").isTextual, "adoptionFee must be a JSON string")
        assertEquals("49.99", json.get("adoptionFee").asText())
    }

    @Test
    fun `money round-trips and normalizes to two decimals`() {
        val read = mapper.readValue<Pet>("""{"id":1,"name":"Rex","type":"dog","adoptionFee":"7.5"}""")
        assertEquals(BigDecimal("7.50"), read.adoptionFee)
        assertEquals(PetType.DOG, read.type)
    }

    // ---- Enum: pinned wire values + forward-compatible fallback ---------

    @Test
    fun `enum constants pin their lower-case wire values`() {
        assertEquals("\"parrot\"", mapper.writeValueAsString(PetType.PARROT))
        assertEquals(PetType.CAT, mapper.readValue<PetType>("\"cat\""))
    }

    @Test
    fun `an unmodeled enum wire value falls back to UNKNOWN`() {
        assertEquals(PetType.UNKNOWN, mapper.readValue<PetType>("\"axolotl\""))
    }

    // ---- Polymorphism: oneOf + discriminator ----------------------------

    @Test
    fun `contact serializes with its kind tag and round-trips by subtype`() {
        val email = mapper.readTree(mapper.writeValueAsString(person()))
        assertEquals("email", email.get("contact").get("kind").asText())

        val phoneJson =
            """{"name":"Ada","pet":{"id":1,"name":"Mittens","type":"cat","adoptionFee":"49.99"},"contact":{"kind":"phone","phone":"+44 20 946 0958"}}"""
        val read = mapper.readValue<Person>(phoneJson)

        // Exhaustive `when` — compiles only against a sealed hierarchy.
        val summary = when (val contact = read.contact) {
            is EmailContact -> "email:${contact.email}"
            is PhoneContact -> "phone:${contact.phone}"
        }
        assertEquals("phone:+44 20 946 0958", summary)
    }

    // ---- Access control: readOnly / writeOnly ---------------------------

    @Test
    fun `read-only fields are ignored on input and emitted on output`() {
        val incoming =
            """{"id":99,"name":"Ada","pet":{"id":1,"name":"Mittens","type":"cat","adoptionFee":"49.99"},"contact":{"kind":"email","email":"ada@example.com"},"createdAt":"2024-05-01T12:00:00+02:00"}"""
        val read = mapper.readValue<Person>(incoming)
        assertNull(read.id, "server-assigned id must be ignored on input")
        assertNull(read.createdAt, "server-assigned createdAt must be ignored on input")

        val stored = read.copy(id = 7, createdAt = OffsetDateTime.of(2024, 5, 1, 12, 0, 0, 0, ZoneOffset.ofHours(2)))
        val outgoing = mapper.readTree(mapper.writeValueAsString(stored))
        assertEquals(7, outgoing.get("id").asInt())
        assertEquals("2024-05-01T12:00:00+02:00", outgoing.get("createdAt").asText())
    }

    @Test
    fun `write-only password is read on input and never serialized`() {
        val incoming =
            """{"name":"Ada","pet":{"id":1,"name":"Mittens","type":"cat","adoptionFee":"49.99"},"contact":{"kind":"email","email":"ada@example.com"},"password":"hunter2"}"""
        val read = mapper.readValue<Person>(incoming)
        assertEquals("hunter2", read.password)

        val outgoing = mapper.readTree(mapper.writeValueAsString(read))
        assertFalse(outgoing.has("password"), "write-only password must not serialize")
    }

    // ---- additionalProperties -------------------------------------------

    @Test
    fun `attributes default to an empty map and round-trip when present`() {
        val without = mapper.readValue<Person>(
            """{"name":"Ada","pet":{"id":1,"name":"Mittens","type":"cat","adoptionFee":"49.99"},"contact":{"kind":"email","email":"ada@example.com"}}"""
        )
        assertEquals(emptyMap<String, String>(), without.attributes)

        val with = person().copy(attributes = mapOf("team" to "analytical-engines"))
        val round = mapper.readValue<Person>(mapper.writeValueAsString(with))
        assertEquals(mapOf("team" to "analytical-engines"), round.attributes)
    }

    // ---- Forward compatibility ------------------------------------------

    @Test
    fun `unknown JSON fields are tolerated`() {
        val read = mapper.readValue<Person>(
            """{"name":"Ada","pet":{"id":1,"name":"Mittens","type":"cat","adoptionFee":"49.99"},"contact":{"kind":"email","email":"ada@example.com"},"futureField":true}"""
        )
        assertEquals("Ada", read.name)
    }
}
