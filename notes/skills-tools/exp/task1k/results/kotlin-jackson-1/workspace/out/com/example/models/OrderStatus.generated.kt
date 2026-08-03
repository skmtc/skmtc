package com.example.models

import com.fasterxml.jackson.annotation.JsonProperty

enum class OrderStatus {
    @JsonProperty("pending")
    PENDING,
    @JsonProperty("paid")
    PAID,
    @JsonProperty("shipped")
    SHIPPED,
    @JsonProperty("cancelled")
    CANCELLED
}
