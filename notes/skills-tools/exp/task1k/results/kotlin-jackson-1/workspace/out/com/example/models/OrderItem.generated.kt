package com.example.models

import com.fasterxml.jackson.annotation.JsonProperty

data class OrderItem(
    val sku: String,
    val quantity: Int,
    @JsonProperty("unit_price")
    val unitPrice: Double,
    @JsonProperty("gift_wrap")
    val giftWrap: Boolean? = null
)
