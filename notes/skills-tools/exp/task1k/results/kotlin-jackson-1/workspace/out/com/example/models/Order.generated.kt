package com.example.models

import com.fasterxml.jackson.annotation.JsonProperty

data class Order(
    val id: String,
    val `object`: String,
    val status: OrderStatus,
    val items: List<OrderItem>,
    @JsonProperty("shipping_address")
    val shippingAddress: Address,
    @JsonProperty("billing_address")
    val billingAddress: Address? = null,
    @JsonProperty("customer_notes")
    val customerNotes: String? = null
)
