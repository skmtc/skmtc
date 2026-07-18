import { assertEquals } from '@std/assert'
import type { GenerateContextType } from '@skmtc/core/generate'
import { KtFile } from './KtFile.ts'
import { KtImport } from './KtImport.ts'
import { KtDefinition } from './KtDefinition.ts'
import { KtParameterList } from './KtParameterList.ts'
import { KtAnnotation } from './KtAnnotation.ts'
import { createDataClass } from './createIdentifier.ts'

// Construction only stores `context`; `toString()` never reads it (test-only cast).
const context = {} as unknown as GenerateContextType
const destinationPath = '@/test/Test.generated.kt'

Deno.test('package directive is derived from the file path', () => {
  const file = new KtFile({ path: '@/com/example/api/User.generated.kt', settings: undefined })

  assertEquals(file.packageName, 'com.example.api')
})

Deno.test('a root-level file renders no package line (default package)', () => {
  const file = new KtFile({ path: '@/Scratch.kt', settings: undefined })
  file.definitions.set(
    'MAX',
    new KtDefinition({
      context,
      identifier: createDataClass('User'),
      value: new KtParameterList([{ name: 'id', type: 'String' }])
    })
  )

  assertEquals(file.toString(), 'data class User(\n    val id: String\n)\n')
})

Deno.test('imports render sorted alphabetically (registration-order independence)', () => {
  const file = new KtFile({ path: '@/com/example/api/User.generated.kt', settings: undefined })
  file.addImports([
    KtImport.fromConcise('kotlinx.serialization', ['Serializable']),
    KtImport.fromConcise('com.example.shared', ['Money'])
  ])

  assertEquals(
    file.toString(),
    'package com.example.api\n\n' +
      'import com.example.shared.Money\n' +
      'import kotlinx.serialization.Serializable\n'
  )
})

Deno.test('same-package imports are suppressed (Kotlin needs no import for them)', () => {
  const file = new KtFile({ path: '@/com/example/api/Order.generated.kt', settings: undefined })
  file.addImports([
    // The Driver's cross-file peer import: same package → suppressed
    KtImport.fromConcise('@/com/example/api/User.generated.kt', ['User']),
    // Different package → renders
    KtImport.fromConcise('@/com/example/models/Money.generated.kt', ['Money'])
  ])

  assertEquals(file.toString(), 'package com.example.api\n\nimport com.example.models.Money\n')
})

Deno.test('the Track 2 User-DTO worked example renders byte-for-byte (note 19 snapshot)', () => {
  class AnnotatedDataClassValue {
    annotations = [new KtAnnotation({ context, destinationPath, name: 'Serializable' })]
    parameters: KtParameterList

    constructor(parameters: KtParameterList) {
      this.parameters = parameters
    }

    toString(): string {
      return `${this.parameters}`
    }
  }

  const file = new KtFile({ path: '@/com/example/api/User.generated.kt', settings: undefined })

  file.addImports([KtImport.fromConcise('kotlinx.serialization', ['Serializable', 'SerialName'])])

  file.definitions.set(
    'User',
    new KtDefinition({
      context,
      identifier: createDataClass('User'),
      value: new AnnotatedDataClassValue(
        new KtParameterList([
          {
            name: 'userId',
            type: 'String',
            annotations: [new KtAnnotation({ context, destinationPath, name: 'SerialName', args: ['"user_id"'] })]
          },
          { name: 'name', type: 'String' },
          { name: 'email', type: 'String', nullable: true, defaultValue: 'null' }
        ])
      )
    })
  )

  assertEquals(
    file.toString(),
    'package com.example.api\n' +
      '\n' +
      'import kotlinx.serialization.SerialName\n' +
      'import kotlinx.serialization.Serializable\n' +
      '\n' +
      '@Serializable\n' +
      'data class User(\n' +
      '    @SerialName("user_id") val userId: String,\n' +
      '    val name: String,\n' +
      '    val email: String? = null\n' +
      ')\n'
  )
})

Deno.test('multi-package mode derives the package with the owning rootPath stripped', () => {
  const settings = {
    basePath: 'generated',
    packages: [
      { rootPath: 'my-sdk-core/src/main/kotlin' },
      { rootPath: 'my-sdk-client-okhttp/src/main/kotlin' }
    ]
  }

  const file = new KtFile({
    path: 'my-sdk-core/src/main/kotlin/com/example/core/ClientOptions.kt',
    settings
  })

  assertEquals(file.packageName, 'com.example.core')
})

Deno.test('multi-package mode resolves cross-rootPath imports to real dotted packages', () => {
  const settings = {
    basePath: 'generated',
    packages: [
      { rootPath: 'my-sdk-core/src/main/kotlin' },
      { rootPath: 'my-sdk-client-okhttp/src/main/kotlin' }
    ]
  }

  const file = new KtFile({
    path: 'my-sdk-client-okhttp/src/main/kotlin/com/example/client/okhttp/OkHttpClient.kt',
    settings
  })
  file.addImports([
    // Cross-module import → the target module's real package
    KtImport.fromConcise('my-sdk-core/src/main/kotlin/com/example/core/ClientOptions.kt', [
      'ClientOptions'
    ]),
    // Same-package import within this module → suppressed
    KtImport.fromConcise(
      'my-sdk-client-okhttp/src/main/kotlin/com/example/client/okhttp/Defaults.kt',
      ['Defaults']
    )
  ])

  assertEquals(
    file.toString(),
    'package com.example.client.okhttp\n\nimport com.example.core.ClientOptions\n'
  )
})

Deno.test('header renders above the package directive', () => {
  const file = new KtFile({
    path: '@/com/example/api/User.generated.kt',
    settings: undefined,
    header: '// Generated file — do not edit.'
  })
  file.addImports([KtImport.fromConcise('kotlinx.serialization', ['Serializable'])])

  assertEquals(
    file.toString(),
    '// Generated file — do not edit.\n\n' +
      'package com.example.api\n\n' +
      'import kotlinx.serialization.Serializable\n'
  )
})
