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
            VITE_PLATFORM_API_URL: 'https://platform.reapit.cloud'
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
            VITE_PLATFORM_API_URL: 'https://platform.reapit.cloud'
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
            VITE_PLATFORM_API_URL: 'https://platform.reapit.cloud'
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
