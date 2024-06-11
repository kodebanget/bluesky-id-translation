import * as React from 'react'
import {View} from 'react-native'
import {PWI_ENABLED, NEW_ONBOARDING_ENABLED} from '#/lib/build-flags'

// Based on @react-navigation/native-stack/src/createNativeStackNavigator.ts
// MIT License
// Copyright (c) 2017 React Navigation Contributors

import {
  createNavigatorFactory,
  EventArg,
  ParamListBase,
  StackActionHelpers,
  StackActions,
  StackNavigationState,
  StackRouter,
  StackRouterOptions,
  useNavigationBuilder,
} from '@react-navigation/native'
import type {
  NativeStackNavigationEventMap,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack'
import type {NativeStackNavigatorProps} from '@react-navigation/native-stack/src/types'
import {NativeStackView} from '@react-navigation/native-stack'

import {BottomBarWeb} from './bottom-bar/BottomBarWeb'
import {DesktopLeftNav} from './desktop/LeftNav'
import {DesktopRightNav} from './desktop/RightNav'
import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {useOnboardingState} from '#/state/shell'
import {
  useLoggedOutView,
  useLoggedOutViewControls,
} from '#/state/shell/logged-out'
import {useSession} from '#/state/session'
import {isWeb} from 'platform/detection'
import {Deactivated} from '#/screens/Deactivated'
import {LoggedOut} from '../com/auth/LoggedOut'
import {Onboarding} from '../com/auth/Onboarding'
import {Onboarding as NewOnboarding} from '#/screens/Onboarding'

type NativeStackNavigationOptionsWithAuth = NativeStackNavigationOptions & {
  requireAuth?: boolean
}

function NativeStackNavigator({
  id,
  initialRouteName,
  children,
  screenListeners,
  screenOptions,
  ...rest
}: NativeStackNavigatorProps) {
  // --- this is copy and pasted from the original native stack navigator ---
  const {state, descriptors, navigation, NavigationContent} =
    useNavigationBuilder<
      StackNavigationState<ParamListBase>,
      StackRouterOptions,
      StackActionHelpers<ParamListBase>,
      NativeStackNavigationOptionsWithAuth,
      NativeStackNavigationEventMap
    >(StackRouter, {
      id,
      initialRouteName,
      children,
      screenListeners,
      screenOptions,
    })
  React.useEffect(
    () =>
      // @ts-expect-error: there may not be a tab navigator in parent
      navigation?.addListener?.('tabPress', (e: any) => {
        const isFocused = navigation.isFocused()

        // Run the operation in the next frame so we're sure all listeners have been run
        // This is necessary to know if preventDefault() has been called
        requestAnimationFrame(() => {
          if (
            state.index > 0 &&
            isFocused &&
            !(e as EventArg<'tabPress', true>).defaultPrevented
          ) {
            // When user taps on already focused tab and we're inside the tab,
            // reset the stack to replicate native behaviour
            navigation.dispatch({
              ...StackActions.popToTop(),
              target: state.key,
            })
          }
        })
      }),
    [navigation, state.index, state.key],
  )

  // --- our custom logic starts here ---
  const {hasSession, currentAccount} = useSession()
  const activeRoute = state.routes[state.index]
  const activeDescriptor = descriptors[activeRoute.key]
  const activeRouteRequiresAuth = activeDescriptor.options.requireAuth ?? false
  const onboardingState = useOnboardingState()
  const {showLoggedOut} = useLoggedOutView()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const {isMobile, isTabletOrMobile} = useWebMediaQueries()
  if ((!PWI_ENABLED || activeRouteRequiresAuth) && !hasSession) {
    return <LoggedOut />
  }
  if (hasSession && currentAccount?.deactivated) {
    return <Deactivated />
  }
  if (showLoggedOut) {
    return <LoggedOut onDismiss={() => setShowLoggedOut(false)} />
  }
  if (onboardingState.isActive) {
    if (NEW_ONBOARDING_ENABLED) {
      return <NewOnboarding />
    } else {
      return <Onboarding />
    }
  }
  const newDescriptors: typeof descriptors = {}
  for (let key in descriptors) {
    const descriptor = descriptors[key]
    const requireAuth = descriptor.options.requireAuth ?? false
    newDescriptors[key] = {
      ...descriptor,
      render() {
        if (requireAuth && !hasSession) {
          return <View />
        } else {
          return descriptor.render()
        }
      },
    }
  }

  // Show the bottom bar if we have a session only on mobile web. If we don't have a session, we want to show it
  // on both tablet and mobile web so that we see the sign up CTA.
  const showBottomBar = hasSession ? isMobile : isTabletOrMobile

  return (
    <NavigationContent>
      <NativeStackView
        {...rest}
        state={state}
        navigation={navigation}
        descriptors={newDescriptors}
      />
      {isWeb && showBottomBar && <BottomBarWeb />}
      {isWeb && !showBottomBar && (
        <>
          <DesktopLeftNav />
          <DesktopRightNav routeName={activeRoute.name} />
        </>
      )}
    </NavigationContent>
  )
}

export const createNativeStackNavigatorWithAuth = createNavigatorFactory<
  StackNavigationState<ParamListBase>,
  NativeStackNavigationOptionsWithAuth,
  NativeStackNavigationEventMap,
  typeof NativeStackNavigator
>(NativeStackNavigator)