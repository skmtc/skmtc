package com.example.models

import com.fasterxml.jackson.annotation.JsonProperty

data class Address(
    @JsonProperty("line_1")
    val line1: String,
    @JsonProperty("line_2")
    val line2: String? = null,
    val city: String,
    @JsonProperty("postal_code")
    val postalCode: String,
    val country: String
)
