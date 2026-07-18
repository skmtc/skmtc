package com.example.api.serde

import com.fasterxml.jackson.core.JsonGenerator
import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.JsonDeserializer
import com.fasterxml.jackson.databind.JsonSerializer
import com.fasterxml.jackson.databind.SerializerProvider
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Custom (de)serializers demonstrating field-level Jackson config beyond
 * naming: a monetary amount travels as a fixed-scale decimal *string* so it
 * never picks up binary-float rounding on either side of the wire.
 */

/** Writes a money amount as a two-decimal string, e.g. `"49.99"`. */
class MoneyStringSerializer : JsonSerializer<BigDecimal>() {
    override fun serialize(value: BigDecimal, gen: JsonGenerator, serializers: SerializerProvider) {
        gen.writeString(value.setScale(2, RoundingMode.HALF_UP).toPlainString())
    }
}

/** Reads a money amount from a JSON string (or number) into a two-decimal [BigDecimal]. */
class MoneyStringDeserializer : JsonDeserializer<BigDecimal>() {
    override fun deserialize(p: JsonParser, ctxt: DeserializationContext): BigDecimal =
        BigDecimal(p.valueAsString).setScale(2, RoundingMode.HALF_UP)
}
