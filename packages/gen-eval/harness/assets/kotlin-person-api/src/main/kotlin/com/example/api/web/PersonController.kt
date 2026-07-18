package com.example.api.web

import com.example.api.dto.Person
import com.example.api.service.PersonService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/people")
class PersonController(private val service: PersonService) {

    @GetMapping
    fun list(): List<Person> = service.findAll()

    @GetMapping("/{id}")
    fun getById(@PathVariable id: Int): ResponseEntity<Person> {
        val person = service.findById(id)
        return if (person != null) ResponseEntity.ok(person)
        else ResponseEntity.notFound().build()
    }

    @PostMapping
    fun create(@RequestBody person: Person): ResponseEntity<Person> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.save(person))
}
