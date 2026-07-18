package com.example.api.service

import com.example.api.dto.Person
import org.springframework.stereotype.Service

/**
 * SCAFFOLD — generated once, then owned by a human/LLM. Safe to edit; the
 * generator will not overwrite this file on regeneration.
 *
 * Each method is a `TODO()` stub: the project compiles and wires up, but any
 * call throws `NotImplementedError` until the body is filled in. `TODO()`
 * returns `Nothing`, so the stubs typecheck against the [PersonService]
 * contract as-is.
 *
 * Replace the bodies with a real implementation (in-memory, JDBC, etc.).
 */
@Service
class InMemoryPersonService : PersonService {

    override fun findAll(): List<Person> =
        TODO("Return all stored people, ordered by id")

    override fun findById(id: Int): Person? =
        TODO("Return the person with the given id, or null if absent")

    override fun save(person: Person): Person =
        TODO("Store the person (overwrite same id) and return it")
}
