import { FC } from 'react'
import { Route, BrowserRouter, Routes, Navigate } from 'react-router-dom'
import { Routes as RoutePaths } from '../constants/routes'
import PrivateRouteWrapper from './private-route-wrapper'
import { LoginModule } from '../components/login'
import { NewModule } from '../components/new'
import { routes } from './routes.generated'

export const RoutesComponent: FC = () => (
  <>
    <Routes>
      <Route path={RoutePaths.LOGIN} element={<LoginModule />} />
      {routes.map(({path, element}) => (
        <Route
          key={path}
          path={path}
          element={element}
        />
      ))}
      <Route
        path={RoutePaths.NEW}
        element={
          <PrivateRouteWrapper>
            <NewModule />
          </PrivateRouteWrapper>
        }
      />
      <Route
        path="/"
        index
        element={<Navigate to={`/contacts/list${window.location.search}`} replace />}
      />
    </Routes>
  </>
)

export const Router: FC = () => (
  <BrowserRouter>
    <RoutesComponent />
  </BrowserRouter>
)
