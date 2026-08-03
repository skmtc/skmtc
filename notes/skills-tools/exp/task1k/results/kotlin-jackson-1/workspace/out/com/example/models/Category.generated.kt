package com.example.models

data class Category(
    val id: String,
    val name: String,
    val children: List<Category>? = null
)
