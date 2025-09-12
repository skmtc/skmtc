import { hc } from 'hono/client'

type ConstructorArgs = {
  workspaceId: string
}

export class WsClient {
  #ws: WebSocket

  constructor({ workspaceId }: ConstructorArgs) {
    const client = hc(`https://${workspaceId}.apifoundry.dev/`)

    this.#ws = client['ws/cli'].$ws(0)
  }

  connect() {
    this.#ws.addEventListener('open', () => {
      // console.log('OPENED')
    })

    this.#ws.addEventListener('message', event => {
      // console.log('MESSAGE', event.data)
    })

    this.#ws.addEventListener('error', event => {
      console.log('ERROR', event)
    })
  }

  async send(message: Message) {
    let count = 0

    const promise = new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        if (this.#ws.readyState === WebSocket.OPEN) {
          this.#ws.send(JSON.stringify(message))
          resolve(undefined)
          clearInterval(timer)
        } else {
          count++

          if (count > 50) {
            reject(new Error('Timeout'))
          }
        }
      }, 100)
    })

    return await promise
  }

  disconnect() {
    if (this.#ws.readyState === WebSocket.OPEN) {
      this.#ws.close()
    }
  }
}

type Message =
  | {
      type: 'update-schema'
      payload: {
        v3JsonFilePath: string
      }
    }
  | {
      type: 'basic-message'
      payload: {
        content: string
      }
    }
