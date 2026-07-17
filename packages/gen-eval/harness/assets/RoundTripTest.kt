import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import models.Animal
import models.Cat
import models.Dog
import models.Price
import models.User
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Harness acceptance tests — DO NOT MODIFY. The gates verify this
 * file's checksum; a run that edits it is disqualified. The generated
 * models are expected in package `models` with refName-derived class
 * names (User, Animal, Dog, Cat, Price, ...).
 */
class RoundTripTest {
    private val mapper: ObjectMapper = jacksonObjectMapper()
        .findAndRegisterModules()
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)

    private fun assertRoundTrip(json: String, value: Any) {
        assertEquals(mapper.readTree(json), mapper.readTree(mapper.writeValueAsString(value)))
    }

    @Test
    fun userRoundTrip() {
        val json =
            """{"user_id":"u1","name":"Ada","email":"ada@example.com","role":"admin","object":"user","created_at":"2026-01-01T00:00:00Z","score":42,"address":{"line1":"1 Main St","city":"London"}}"""
        val user: User = mapper.readValue(json)
        assertRoundTrip(json, user)
    }

    @Test
    fun animalPolymorphism() {
        val json =
            """[{"petType":"dog","name":"Rex","barkVolume":11},{"petType":"cat","name":"Mia","huntingSkill":"lazy"}]"""
        val animals: List<Animal> = mapper.readValue(json)
        assertTrue(animals[0] is Dog, "first animal should deserialize as Dog")
        assertTrue(animals[1] is Cat, "second animal should deserialize as Cat")
        assertRoundTrip(json, animals)
    }

    @Test
    fun priceStructureUnion() {
        val json = """{"id":"p1","structure":{"pricingType":"FIXED","price":"10.00"}}"""
        val price: Price = mapper.readValue(json)
        assertRoundTrip(json, price)
    }
}
