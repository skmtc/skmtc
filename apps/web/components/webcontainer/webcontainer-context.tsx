'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
import { FileSystemTree, WebContainer } from '@webcontainer/api'
import hash from 'object-hash'

type WebcontainerProviderProps = {
  fileNodes: FileSystemTree
  children: ReactNode
}

const WebcontainerStateContext = createContext<
  | {
      webContainerUrl: string | null
      remount: (fileTree: FileSystemTree) => Promise<void>
      status: WebcontainerStatus
    }
  | undefined
>(undefined)

type WebcontainerStatus = 'empty' | 'remounting' | 'ready'

const WebcontainerProvider = ({ fileNodes, children }: WebcontainerProviderProps) => {
  const [ready, setReady] = useState(false)
  const webContainerRef = useRef<WebContainer | null>(null)
  const webContainerHashRef = useRef<string | null>(null)
  const [status, setStatus] = useState<WebcontainerStatus>('empty')

  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    // return () => {
    //   console.log('PROVIDER READY')
    setReady(true)
    //}
  }, [])

  useEffect(() => {
    if (!ready) {
      console.log('PROVIDER NOT READY')
      return
    }

    console.log('BOOTING')

    WebContainer.boot({
      coep: 'credentialless'
    })
      .then(async webContainer => {
        console.log('MOUNTING')

        webContainerHashRef.current = hash(fileNodes)

        await webContainer.mount(fileNodes)
        return webContainer
      })
      .then(async webContainer => {
        console.log('INSTALLING')

        const installProcess = await webContainer.spawn('pnpm', ['install'], {
          env: {
            VITE_APP_ENV: 'local',
            VITE_CONNECT_CLIENT_ID: '4j7u49bnip8gsf4ujteu7ojkoq',
            VITE_CONNECT_USER_POOL_ID: 'eu-west-2_eQ7dreNzJ',
            VITE_CONNECT_OAUTH_URL: 'https://connect.reapit.cloud',
            VITE_PLATFORM_API_URL: 'https://8e88924edb2f.ngrok.app/api'
          }
        })

        const installExitCode = await installProcess.exit

        if (installExitCode !== 0) {
          throw new Error('Unable to run pnpm install')
        }

        console.log('SET WEBCONTAINER')

        webContainerRef.current = webContainer
        setStatus('ready')
      })
      .catch(error => {
        console.error(error)
      })

    return () => {
      console.log('TEARING DOWN')

      webContainerRef.current?.teardown()
    }
  }, [ready])

  const remount = useCallback(
    async (fileTree: FileSystemTree) => {
      try {
        if (!webContainerRef.current || status !== 'ready') {
          return
        }

        if (webContainerHashRef.current === hash(fileTree)) {
          return
        }

        setStatus('remounting')

        const webContainer = webContainerRef.current

        webContainerHashRef.current = hash(fileTree)

        await webContainer.mount(fileTree)

        // @TODO: Get these from the environment

        const buildProcess = await webContainer.spawn('pnpm', ['build'], {
          env: {
            VITE_APP_ENV: 'local',
            VITE_CONNECT_CLIENT_ID: '4j7u49bnip8gsf4ujteu7ojkoq',
            VITE_CONNECT_USER_POOL_ID: 'eu-west-2_eQ7dreNzJ',
            VITE_CONNECT_OAUTH_URL: 'https://connect.reapit.cloud',
            VITE_PLATFORM_API_URL: 'https://8e88924edb2f.ngrok.app/api'
          }
        })

        buildProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log(data)
            }
          })
        )

        const buildExitCode = await buildProcess.exit

        if (buildExitCode !== 0) {
          throw new Error('Unable to run pnpm build')
        }

        const startProcess = await webContainer.spawn('pnpm', ['start'], {
          env: {
            VITE_APP_ENV: 'local',
            VITE_CONNECT_CLIENT_ID: '4j7u49bnip8gsf4ujteu7ojkoq',
            VITE_CONNECT_USER_POOL_ID: 'eu-west-2_eQ7dreNzJ',
            VITE_CONNECT_OAUTH_URL: 'https://connect.reapit.cloud',
            VITE_PLATFORM_API_URL: 'https://8e88924edb2f.ngrok.app/api',
            // @TODO: Get this from the environment
            VITE_AUTH_TOKEN:
              'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjdYWl9lTENtcjF6Z1dOa2czdUZHNiJ9.eyJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJ1c2VybmFtZSI6ImQuZ3JhYm92QGdtYWlsLmNvbSIsImlzcyI6Imh0dHBzOi8vY29ubmVjdC5yZWFwaXQuY2xvdWQvIiwic3ViIjoiYXV0aDB8ZXUtd2VzdC0yX2VRN2RyZU56SnxmMzhiN2Y4Yi02ZDEzLTRiYWYtYjE4ZS03OTM5MWNiNmMxNGQiLCJhdWQiOlsiaHR0cHM6Ly9wbGF0Zm9ybS5yZWFwaXQuY2xvdWQiLCJodHRwczovL3JjdWstNzd4dTQ4eXJqMWljbjhtbnNrOWF1bHgybTVlM2Y2LnVrLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE3MzYyNDc2MzUsImV4cCI6MTczNjI1MTIzNSwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCBvZmZsaW5lX2FjY2VzcyBhZ2VuY3lDbG91ZC9hcHBsaWNhbnRzLnJlYWQgYWdlbmN5Q2xvdWQvYXBwbGljYW50cy53cml0ZSBhZ2VuY3lDbG91ZC9hcHBvaW50bWVudHMucmVhZCBhZ2VuY3lDbG91ZC9hcHBvaW50bWVudHMud3JpdGUgYWdlbmN5Q2xvdWQvYXJlYXMud3JpdGUgYWdlbmN5Q2xvdWQvY29tcGFuaWVzLnJlYWQgYWdlbmN5Q2xvdWQvY29tcGFuaWVzLndyaXRlIGFnZW5jeUNsb3VkL2NvbnRhY3RzLnJlYWQgYWdlbmN5Q2xvdWQvY29udGFjdHMud3JpdGUgYWdlbmN5Q2xvdWQvY29udmV5YW5jaW5nLnJlYWQgYWdlbmN5Q2xvdWQvY29udmV5YW5jaW5nLndyaXRlIGFnZW5jeUNsb3VkL2RvY3VtZW50cy5yZWFkIGFnZW5jeUNsb3VkL2RvY3VtZW50cy53cml0ZSBhZ2VuY3lDbG91ZC9lbnF1aXJpZXMucmVhZCBhZ2VuY3lDbG91ZC9lbnF1aXJpZXMud3JpdGUgYWdlbmN5Q2xvdWQvaWRlbnRpdHljaGVja3MucmVhZCBhZ2VuY3lDbG91ZC9pZGVudGl0eWNoZWNrcy53cml0ZSBhZ2VuY3lDbG91ZC9pbnZvaWNlcy5yZWFkIGFnZW5jeUNsb3VkL2pvdXJuYWxlbnRyaWVzLnJlYWQgYWdlbmN5Q2xvdWQvam91cm5hbGVudHJpZXMud3JpdGUgYWdlbmN5Q2xvdWQva2V5cy5yZWFkIGFnZW5jeUNsb3VkL2tleXMud3JpdGUgYWdlbmN5Q2xvdWQvbGFuZGxvcmRzLnJlYWQgYWdlbmN5Q2xvdWQvbGFuZGxvcmRzLndyaXRlIGFnZW5jeUNsb3VkL25lZ290aWF0b3JzLnJlYWQgYWdlbmN5Q2xvdWQvbmVnb3RpYXRvcnMud3JpdGUgYWdlbmN5Q2xvdWQvb2ZmZXJzLnJlYWQgYWdlbmN5Q2xvdWQvb2ZmZXJzLndyaXRlIGFnZW5jeUNsb3VkL29mZmljZXMucmVhZCBhZ2VuY3lDbG91ZC9vZmZpY2VzLndyaXRlIGFnZW5jeUNsb3VkL3Byb3BlcnRpZXMucmVhZCBhZ2VuY3lDbG91ZC9wcm9wZXJ0aWVzLndyaXRlIGFnZW5jeUNsb3VkL3JlZmVycmFscy5yZWFkIGFnZW5jeUNsb3VkL3JlZmVycmFscy53cml0ZSBhZ2VuY3lDbG91ZC9zb3VyY2VzLndyaXRlIGFnZW5jeUNsb3VkL3Rhc2tzLnJlYWQgYWdlbmN5Q2xvdWQvdGFza3Mud3JpdGUgYWdlbmN5Q2xvdWQvdGVuYW5jaWVzLnJlYWQgYWdlbmN5Q2xvdWQvdGVuYW5jaWVzLndyaXRlIGFnZW5jeUNsb3VkL3RyYW5zYWN0aW9ucy5yZWFkIGFnZW5jeUNsb3VkL3RyYW5zYWN0aW9ucy53cml0ZSBhZ2VuY3lDbG91ZC92ZW5kb3JzLnJlYWQgYWdlbmN5Q2xvdWQvdmVuZG9ycy53cml0ZSBhZ2VuY3lDbG91ZC93b3Jrc29yZGVycy5yZWFkIGFnZW5jeUNsb3VkL3dvcmtzb3JkZXJzLndyaXRlIiwiYXpwIjoiNGo3dTQ5Ym5pcDhnc2Y0dWp0ZXU3b2prb3EifQ.Kqz1fQtYkedrT5dp3BJm9XkA0p3pgDZh7gchjTDOcLZfKjdvmmaC4pwofGSqm3b3KvKW3XXTXKzO8t6iZ1PyCjiTQiYfafGHtqnoq_uB5uqvxAIbzLIROQ0FKrr-H99yzFfPgDcJ10m0YnpFRfmdv32JM8ak7l3WWSSXksUxlHvABtJC9Sj8ptncMW0Cvxwy_N6Z-3DwchKKzm3aquZhiOhx3a5Z3C030iHUiIXi9TFfAO8vE8dv9l_27BfapMkpbKxPXZ-67fy1e0vakYVyIEn00DU1UCIidhFqt-n9LsJB0F9ENAZmvLZL_XU0xPlaaM9TrcqknTbsyN6hYLA4aA'
          }
        })

        startProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log(data)
            }
          })
        )

        webContainer.on('server-ready', (port, url) => {
          console.log(`[LOG] PORT: ${port}`)
          setStatus('ready')

          setUrl(url)
        })
      } catch (error) {
        console.error(error)
      }
    },
    [webContainerRef.current]
  )

  return (
    <WebcontainerStateContext.Provider value={{ remount, webContainerUrl: url, status }}>
      {children}
    </WebcontainerStateContext.Provider>
  )
}

const useWebcontainer = () => {
  const context = useContext(WebcontainerStateContext)

  if (context === undefined) {
    throw new Error('useWebcontainer must be used within a WebcontainerProvider')
  }

  return context
}

export { WebcontainerProvider, useWebcontainer }
