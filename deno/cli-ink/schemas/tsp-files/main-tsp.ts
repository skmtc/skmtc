export class MainTsp {
  name: string

  constructor(name: string) {
    this.name = name
  }

  toString() {
    return `import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;

@service(#{ title: "${name}" })
@server("https://example.com", "")
namespace PetStore;

model Location {
  lat: numeric;
  lng: numeric;
}

const archie: Dog = #{id: "1", name: "Archie", breed: "dachshund"};
const amos: Dog = #{id: "2", name: "Amos", breed: "dachshund"};

model Dog {
  id: string;
  name: string;
  breed: "dalmatian" | "poodle" | "dachshund";
}

@tag("Dogs")
@route("/dogs")
interface Dogs {
  @get
  @summary("Get all dogs")
  @doc("List of all dogs currently in the store")
  @opExample(#{returnType: #[archie, amos]})
  list(): Dog[];

  @post
  @summary("Create new dog")
  @doc("Add a new dog to the store. It will be marked as available immediately.")
  @opExample(#{returnType: archie})
  create(@body body: Dog): Dog;
}
`
  }
}
