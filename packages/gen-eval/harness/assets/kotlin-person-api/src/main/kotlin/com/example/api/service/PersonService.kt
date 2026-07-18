package com.example.api.service

import com.example.api.dto.Person

/**
 * GENERATED CONTRACT — do not edit; regenerated from the domain model.
 *
 * The deterministic half of the service layer: method signatures are derived
 * from the API operations (operation -> method, DTOs -> parameter/return
 * types). The business logic that satisfies this contract is written by a
 * human/LLM in an implementation such as [InMemoryPersonService].
 *
 * Convention encoded here (must match the generated controller):
 *  - "not found" is represented as a nullable return (`Person?`), which the
 *    controller maps to HTTP 404. It is not signalled by an exception.
 */
interface PersonService {

    /** All stored people, ordered by id. Backs `GET /people`. */
    fun findAll(): List<Person>

    /** The person with [id], or `null` if none exists. Backs `GET /people/{id}`. */
    fun findById(id: Int): Person?

    /** Store [person] (overwriting any existing entry with the same id) and return it. Backs `POST /people`. */
    fun save(person: Person): Person
}
