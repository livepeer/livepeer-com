import useApi from "./use-api";
import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Verifies that the user is logged in. Redirects to /login if not. Pass
 * `false` to verify that the user is _not_ logged in.
 */
export default (shouldBeLoggedIn = true) => {
  const { user, token } = useApi();
  const router = useRouter();
  const { next } = router.query;

  useEffect(() => {
    if (shouldBeLoggedIn === true) {
      if (!token) {
        router.replace("/login");
      } else if (user && user.emailValid === false) {
        router.replace("/verify");
      }
    }
    // Check for user rather than token so we don't redirect until we've checked
    if (shouldBeLoggedIn === false && user) {
      if (user.emailValid === false) {
        router.replace("/verify");
      } else {
        router.replace(next ? next.toString() : "/dashboard");
      }
    }
  }, [user, token, next]);
};
