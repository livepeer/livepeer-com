import React from 'react'
import {
  BrowserRouter,
  HashRouter,
  Redirect,
  Route,
  Switch,
  matchPath,
} from 'react-router-dom'
import { TransitionGroup, CSSTransition } from 'react-transition-group'
import { Button, CTA, CTABanner, Modal } from '../components'
import Account from '../views/Account'
import Approve from '../views/Approve'
import Bond from '../views/Bond'
import ClaimEarnings from '../views/ClaimEarnings'
import ImportantMessage from '../views/ImportantMessage'
import Landing from '../views/Landing'
import SmartContracts from '../views/SmartContracts'
import ToastNotifications from '../views/ToastNotifications'
import Transcoders from '../views/Transcoders'

const App = () => (
  <BrowserRouter>
    <div>
      {/* Pages */}
      <Switch>
        <Route exact path="/" component={Landing} />
        <Route exact path="/transcoders" component={Transcoders} />
        <Route
          path="/accounts/:accountId"
          render={props => {
            const isEthAddress = /^0x[a-fA-F0-9]{40}$/.test(
              props.match.params.accountId,
            )
            return isEthAddress ? <Account {...props} /> : <Redirect to="/" />
          }}
        />
        <Route
          path="/me"
          render={(props, ctx) => {
            const { pathname, search } = props.location
            const account = window.livepeer.config.defaultTx.from
            const authenticated =
              account &&
              account !== '0x0000000000000000000000000000000000000000'
            const nextPath =
              (authenticated
                ? pathname.replace(/^\/me/, `/accounts/${account}`)
                : '/') + search
            return <Redirect to={nextPath} />
          }}
        />
        <Redirect to="/" />
      </Switch>
      {/* Modals */}
      <Route
        render={({ location }) => (
          <TransitionGroup>
            <CSSTransition
              key={location.hash}
              classNames="modal"
              timeout={1000}
            >
              <Switch
                location={{
                  get pathname() {
                    // use hash as pathname
                    return location.hash.substr(1)
                  },
                }}
              >
                <Route path="/approve/:delegateAddress" component={Approve} />
                <Route path="/bond/:delegateAddress" component={Bond} />
                <Route path="/claim-earnings" component={ClaimEarnings} />
                <Route path="/smart-contracts" component={SmartContracts} />
              </Switch>
            </CSSTransition>
          </TransitionGroup>
        )}
      />
      <Route component={ImportantMessage} />
      <ToastNotifications />
      <Switch>
        <Route exact path="/transcoders" component={() => null} />
        <Route
          path="*"
          render={({ history }) => (
            <CTABanner flag="view-transcoders">
              <div>
                If you are a token holder, you can participate in the network by
                staking towards a transcoder to earn fees and LPT rewards.
              </div>
              <div>
                <Button
                  style={{ margin: 0 }}
                  onClick={() => history.push('/transcoders?tour=true')}
                >
                  Start Delegating
                </Button>
              </div>
            </CTABanner>
          )}
        />
      </Switch>
    </div>
  </BrowserRouter>
)

export default App
