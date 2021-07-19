import { Box, Flex, Container, Link as A } from "@livepeer.com/design-system";
import { useApi } from "hooks";
import React, { useCallback, useEffect, useState } from "react";
import Menu from "./mobile/menu";
import { useRouter } from "next/router";
import NavigationBreadcrumb, { BreadcrumbItem } from "./breadcrumb";
import Link from "next/link";
import Guides from "components/Redesign/Guides";
import Button from "components/Redesign/Button";
import { HamburgerMenuIcon } from "@radix-ui/react-icons";

const sidesWidth = "250px"; // We provide the same value for the logo and the CTAs so the center links are really centered.

type Props = {
  links: React.ComponentProps<typeof Link>[];
  breadcrumb?: BreadcrumbItem[];
  withShadow?: boolean;
  css?: any;
};

const NavigationBase = ({
  links,
  breadcrumb,
  withShadow = true,
  css,
}: Props) => {
  const { pathname } = useRouter();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [mobileMenuIsOpen, setMobileMenuIsOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const { token, user, logout } = useApi();
  const isDashboard = pathname.includes("/dashboard/");

  const handleScroll = useCallback(() => {
    const { scrollTop } = document.documentElement;
    if (scrollTop > 0) setHasScrolled(true);
    else setHasScrolled(false);
  }, []);

  useEffect(() => {
    handleScroll();
    document.addEventListener("scroll", handleScroll);

    return () => {
      document.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (token) {
      setLoggedIn(true);
    } else {
      setLoggedIn(false);
    }
  }, [token]);

  return (
    <Box>
      <Guides backgroundColor="$loContrast" />
      <Box
        css={{
          position: "relative",
          zIndex: mobileMenuIsOpen ? 22 : 22,
          "&:after": {
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "1px",
            margin: 0,
            border: "none",
            background:
              "linear-gradient(90deg,$colors$mauve4,$colors$mauve4 50%,transparent 0,transparent)",
            backgroundSize: "8px 1px",
            content: '""',
          },
          ...css,
        }}>
        <Container
          size="3"
          css={{
            px: "$4",
            mx: "$4",
            "@bp3": {
              px: "$4",
              mx: "auto",
            },
          }}>
          <Flex
            css={{
              py: "$4",
              justifyContent: "space-between",
              ai: "center",
            }}>
            <Box
              css={{
                minWidth: sidesWidth,
                display: "flex",
                alignItems: "center",
              }}>
              <NavigationBreadcrumb breadcrumb={breadcrumb} withLogoType />
            </Box>
            <Flex
              css={{
                width: "100%",
                justifyContent: "center",
                ai: "center",
                "@bp1": {
                  display: "none",
                },
                "@bp2": {
                  display: "flex",
                },
              }}>
              {links.map((link) => (
                <Link href={link.href} key={`nav-link-${link.href}`} passHref>
                  <A
                    css={{
                      fontSize: "$3",
                      fontWeight: 600,
                      textDecoration: "none",
                      mx: "$3",
                    }}>
                    {link.children}
                  </A>
                </Link>
              ))}
            </Flex>
            <Flex
              css={{
                "@bp1": {
                  display: "none",
                },
                "@bp2": {
                  display: "flex",
                },
                ai: "center",
                justifyContent: "flex-end",
                minWidth: sidesWidth,
              }}>
              {!loggedIn && (
                <>
                  <Link href="/login" passHref>
                    <A
                      css={{
                        fontSize: "$3",
                        fontWeight: 600,
                        textDecoration: "none",
                        mr: "$4",
                      }}>
                      Log in
                    </A>
                  </Link>
                  <Link href="/register" passHref>
                    <Button as="a" arrow>
                      Sign up
                    </Button>
                  </Link>
                </>
              )}
              {loggedIn && (
                <>
                  {user && user.admin && !isDashboard && (
                    <Link href="/app/admin" passHref>
                      <A
                        css={{
                          fontSize: "$3",
                          fontWeight: 600,
                          textDecoration: "none",
                          mr: "$4",
                        }}>
                        Admin
                      </A>
                    </Link>
                  )}
                  {isDashboard && (
                    <Link href="/docs/guides" passHref>
                      <A>Docs</A>
                    </Link>
                  )}
                  {isDashboard && (
                    <Link href="/contact" passHref>
                      <A>Contact</A>
                    </Link>
                  )}

                  {!isDashboard && (
                    <Link href="/dashboard" passHref>
                      <Button as="a" arrow>
                        Dashboard
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </Flex>
            <Flex
              css={{
                backgroundColor: "$panel",
                borderRadius: 20,
                fontSize: 6,
                py: "$1",
                px: "$3",
                cursor: "pointer",
                flexShrink: 0,
                "@bp2": {
                  display: "none",
                },
              }}
              onClick={() => setMobileMenuIsOpen(true)}>
              <HamburgerMenuIcon />
            </Flex>
          </Flex>
        </Container>
        <Menu
          mobileMenuIsOpen={mobileMenuIsOpen}
          setMobileMenuIsOpen={setMobileMenuIsOpen}
          user={user}
          token={token}
          links={links}
          breadcrumb={breadcrumb}
        />
      </Box>
    </Box>
  );
};

export default NavigationBase;
