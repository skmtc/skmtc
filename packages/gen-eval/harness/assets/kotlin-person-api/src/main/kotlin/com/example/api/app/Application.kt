package com.example.api.app

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.context.annotation.ComponentScan

@SpringBootApplication
@ComponentScan("com.example.api")
class Application

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}
