'use client'
import {
  createContext,
  MutableRefObject,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
import { FileSystemTree, WebContainer, WebContainerProcess, reloadPreview } from '@webcontainer/api'
import hash from 'object-hash'
import invariant from 'tiny-invariant'

type WebcontainerProviderProps = {
  fileNodes: FileSystemTree
  children: ReactNode
}

const WebcontainerStateContext = createContext<
  | {
      webContainerUrl: string | null
      remount: (fileTree: FileSystemTree) => Promise<void>
      status: WebcontainerStatus
      iframeRef: RefObject<HTMLIFrameElement>
      sharedStatusRef: RefObject<SharedStatus>
      authHeader: string | null
      setAuthHeader: (authHeader: string | null) => void
    }
  | undefined
>(undefined)

type WebcontainerStatus = 'empty' | 'remounting' | 'ready'

type SharedStatus =
  | 'idle'
  | 'booting'
  | 'mounting'
  | 'installing'
  | 'building'
  | 'starting'
  | 'ready'
  | 'error'
  | 'tearing down'

const WebcontainerProvider = ({ fileNodes, children }: WebcontainerProviderProps) => {
  const [ready, setReady] = useState(false)
  const webContainerRef = useRef<WebContainer | null>(null)
  const webContainerHashRef = useRef<string | null>(null)
  const [status, setStatus] = useState<WebcontainerStatus>('empty')
  const sharedStatusRef = useRef<SharedStatus>('idle')
  const [authHeader, setAuthHeader] = useState<string | null>(null)
  // @todo can this be read from the environment instead?
  const currentAuthHeaderRef = useRef<string | null>(null)

  const serverProcessRef = useRef<WebContainerProcess | null>(null)
  const buildProcessRef = useRef<WebContainerProcess | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) {
      console.log('PROVIDER NOT READY')
      return
    }

    sharedStatusRef.current = 'booting'

    WebContainer.boot({
      coep: 'credentialless'
    })
      .then(async webContainer => {
        sharedStatusRef.current = 'mounting'

        webContainerHashRef.current = hash(fileNodes)

        await webContainer.mount(fileNodes)

        sharedStatusRef.current = 'idle'

        return webContainer
      })
      .then(async webContainer => {
        sharedStatusRef.current = 'installing'

        const installProcess = await webContainer.spawn('pnpm', ['install'], {
          env: {
            VITE_APP_ENV: 'local',
            VITE_CONNECT_CLIENT_ID: '4j7u49bnip8gsf4ujteu7ojkoq',
            VITE_CONNECT_USER_POOL_ID: 'eu-west-2_eQ7dreNzJ',
            VITE_CONNECT_OAUTH_URL: 'https://connect.reapit.cloud',
            VITE_PLATFORM_API_URL: `${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/proxy`
          }
        })

        const installExitCode = await installProcess.exit

        if (installExitCode !== 0) {
          sharedStatusRef.current = 'error'
          throw new Error('Unable to run pnpm install')
        }

        console.log('SET READY 3')
        sharedStatusRef.current = 'ready'

        webContainerRef.current = webContainer
        setStatus('ready')
      })
      .catch(error => {
        sharedStatusRef.current = 'error'
        console.error(error)
      })

    return () => {
      sharedStatusRef.current = 'tearing down'

      webContainerRef.current?.teardown()
    }
  }, [ready])

  useEffect(() => {
    console.log('STATUS', status)
    console.log('AUTH HEADER', authHeader)
    console.log('CURRENT AUTH HEADER', currentAuthHeaderRef.current)
    console.log('WEB CONTAINER REF', webContainerRef.current)

    if (
      status !== 'ready' ||
      !authHeader ||
      authHeader === currentAuthHeaderRef.current ||
      !webContainerRef.current
    ) {
      return
    }

    sharedStatusRef.current = 'mounting'

    setStatus('remounting')

    if (buildProcessRef.current) {
      buildProcessRef.current.kill()

      launchBuildProcess({
        webContainer: webContainerRef.current,
        authHeader,
        iframeRef,
        sharedStatusRef,
        currentAuthHeaderRef
      })
        .then(buildProcess => {
          buildProcessRef.current = buildProcess

          invariant(webContainerRef.current, 'WebContainer is not ready')

          serverProcessRef.current?.kill()

          return launchServerProcess({
            webContainer: webContainerRef.current,
            authHeader
          })
        })
        .then(serverProcess => {
          serverProcessRef.current = serverProcess

          setStatus('ready')
        })
    }
  }, [status, authHeader])

  const remount = useCallback(
    async (fileTree: FileSystemTree) => {
      try {
        if (!webContainerRef.current || status !== 'ready') {
          return
        }

        if (webContainerHashRef.current === hash(fileTree)) {
          return
        }

        sharedStatusRef.current = 'mounting'

        setStatus('remounting')

        const webContainer = webContainerRef.current

        webContainerHashRef.current = hash(fileTree)

        await webContainer.mount(fileTree)

        sharedStatusRef.current = 'idle'

        if (buildProcessRef.current) {
          setStatus('ready')
          return
        }

        buildProcessRef.current = await launchBuildProcess({
          webContainer,
          authHeader,
          iframeRef,
          sharedStatusRef,
          currentAuthHeaderRef
        })

        if (serverProcessRef.current) {
          setStatus('ready')
          return
        }

        serverProcessRef.current = await launchServerProcess({ webContainer, authHeader })

        webContainer.on('server-ready', (port, url) => {
          console.log(`[LOG] PORT: ${port}`)
          setStatus('ready')

          setUrl(url)
        })

        webContainer.on('error', error => {
          sharedStatusRef.current = 'error'
          console.error('SERVER ERROR', error)
        })
      } catch (error) {
        console.error(error)
      }
    },
    [webContainerRef.current]
  )

  return (
    <WebcontainerStateContext.Provider
      value={{
        remount,
        webContainerUrl: url,
        status,
        iframeRef,
        sharedStatusRef,
        authHeader,
        setAuthHeader
      }}
    >
      {children}
    </WebcontainerStateContext.Provider>
  )
}

type LaunchBuildProcessProps = {
  webContainer: WebContainer
  authHeader: string | null
  iframeRef: MutableRefObject<HTMLIFrameElement | null>
  sharedStatusRef: MutableRefObject<SharedStatus>
  currentAuthHeaderRef: MutableRefObject<string | null>
}

const launchBuildProcess = async ({
  webContainer,
  authHeader,
  iframeRef,
  sharedStatusRef,
  currentAuthHeaderRef
}: LaunchBuildProcessProps) => {
  // @TODO: Get these from the environment
  const buildProcess = await webContainer.spawn('pnpm', ['build:watch'], {
    env: {
      VITE_APP_ENV: 'local',
      VITE_CONNECT_CLIENT_ID: '4j7u49bnip8gsf4ujteu7ojkoq',
      VITE_CONNECT_USER_POOL_ID: 'eu-west-2_eQ7dreNzJ',
      VITE_CONNECT_OAUTH_URL: 'https://connect.reapit.cloud',
      VITE_PLATFORM_API_URL: `${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/proxy`,
      ...(authHeader ? { VITE_AUTH_HEADER: authHeader } : {})
    }
  })

  buildProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        const dataString = data.toString()

        if (dataString.includes('SKMTC BUILD START')) {
          sharedStatusRef.current = 'building'
        }

        if (dataString.includes('SKMTC CLOSE BUNDLE')) {
          sharedStatusRef.current = 'ready'

          if (iframeRef.current) {
            sharedStatusRef.current = 'ready'

            reloadPreview(iframeRef.current)
          }
        }
      }
    })
  )

  currentAuthHeaderRef.current = authHeader

  return buildProcess
}

type LaunchServerProcessProps = {
  webContainer: WebContainer
  authHeader: string | null
}

const launchServerProcess = async ({ webContainer, authHeader }: LaunchServerProcessProps) => {
  const serverProcess = await webContainer.spawn('pnpm', ['start:watch'], {
    env: {
      VITE_APP_ENV: 'local',
      VITE_CONNECT_CLIENT_ID: '4j7u49bnip8gsf4ujteu7ojkoq',
      VITE_CONNECT_USER_POOL_ID: 'eu-west-2_eQ7dreNzJ',
      VITE_CONNECT_OAUTH_URL: 'https://connect.reapit.cloud',
      VITE_PLATFORM_API_URL: `${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/proxy`,
      ...(authHeader ? { VITE_AUTH_HEADER: authHeader } : {})
    }
  })

  serverProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        console.log(`[SERVER] ${data}`)
      }
    })
  )

  return serverProcess
}

const useWebcontainer = () => {
  const context = useContext(WebcontainerStateContext)

  if (context === undefined) {
    throw new Error('useWebcontainer must be used within a WebcontainerProvider')
  }

  return context
}

export { WebcontainerProvider, useWebcontainer }
