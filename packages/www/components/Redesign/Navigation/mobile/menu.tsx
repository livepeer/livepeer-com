import { Box, Flex, Container, Link as A } from "@livepeer.com/design-system";
import { User } from "@livepeer.com/api";
import Link from "next/link";
import NavigationBreadcrumb, { BreadcrumbItem } from "../breadcrumb";
import { Cross1Icon } from "@radix-ui/react-icons";
import Button from "components/Redesign/Button";

type Props = {
  links: any;
  breadcrumb?: BreadcrumbItem[];
  mobileMenuIsOpen: boolean;
  setMobileMenuIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  token: string | undefined;
  user: User | undefined;
};

const Menu = ({
  mobileMenuIsOpen,
  setMobileMenuIsOpen,
  token,
  user,
  links,
  breadcrumb,
}: Props) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setMobileMenuIsOpen(false);
  };

  return (
    <Box
      css={{
        position: "fixed",
        top: "$3",
        left: "$3",
        height: mobileMenuIsOpen ? "100vh" : 0,
        transition: "height .2s",
        borderRadius: "$3",
        overflow: "hidden",
        width: "calc(100% - $space$3 * 2)",
        zIndex: 1,
        visibility: mobileMenuIsOpen ? "visible" : "hidden",
      }}
      onClick={handleClick}>
      <Box
        css={{
          top: "$3",
          position: "absolute",
          right: "$4",
          cursor: "pointer",
        }}
        onClick={() => setMobileMenuIsOpen(false)}>
        <Cross1Icon />
      </Box>
      <Container
        css={{
          pt: "$6",
          display: "flex",
          flexDirection: "column",
          height: `calc(100vh -70px)`,
          backgroundColor: "$panel",
        }}>
        <Flex css={{ flexDirection: "column" }}>
          {links.map((link) => (
            <Link href={link.href} key={`menu-link-${link.href}`} passHref>
              <A
                variant="violet"
                css={{
                  mb: "$4",
                  "&:last-of-type": {
                    mb: 0,
                  },
                }}>
                {link.children}
              </A>
            </Link>
          ))}
          <Box as="hr" css={{ my: "$3", visibility: "hidden" }} />
        </Flex>
      </Container>
      <Flex
        css={{
          p: "$3",
          ai: "center",
          justifyContent: "center",
          backgroundColor: "$panel",
          borderTop: "1px solid $mauve5",
        }}>
        {!!token ? (
          <>
            <Link href="dashboard" passHref>
              <Button arrow>Dashboard</Button>
            </Link>
            {user && user.admin && (
              <Link href="/app/admin" passHref>
                <A css={{ ml: "$3" }}>Admin</A>
              </Link>
            )}
          </>
        ) : (
          <>
            <Link href="/login" passHref>
              <Button arrow>Login</Button>
            </Link>
          </>
        )}
      </Flex>
    </Box>
  );
};

export default Menu;
