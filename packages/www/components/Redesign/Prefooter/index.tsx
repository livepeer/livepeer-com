import {
  Container,
  Heading,
  Text,
  Flex,
  Box,
  Link as A,
} from "@livepeer.com/design-system";
import Button from "components/Redesign/Button";
import Guides from "components/Redesign/Guides";
import Link from "next/link";

const Prefooter = () => (
  <Box>
    <Guides backgroundColor="$panel" />
    <Container size="3" css={{ px: "$4", py: 120, width: "100%" }}>
      <Box
        css={{
          px: 40,
          py: 80,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          color: "white",
          background:
            "linear-gradient(90deg, $colors$blue9 0%, $colors$violet10 33%,  $colors$violet11 66%, $colors$violet11 100%);",
          backgroundSize: "cover",
          "@bp2": {
            px: 72,
            py: 126,
          },
        }}>
        <Heading
          size="4"
          css={{
            color: "white",
            fontWeight: 700,
            mb: "$6",
            letterSpacing: 0,
          }}>
          Ready to get started?
        </Heading>
        <Text
          variant="gray"
          size="4"
          css={{
            color: "white",
            mb: "$7",
            maxWidth: "700px",
            mx: "auto",
          }}>
          Create a free account instantly and start creating streams. You can
          also contact us to design a custom package for your business.
        </Text>
        <Flex
          css={{
            ai: "center",
            justifyContent: "center",
            flexDirection: "row",
          }}>
          <Link href="/register" passHref>
            <Button size="4" as="a" arrow css={{ mr: "$4" }}>
              Sign up for free
            </Button>
          </Link>
          <Link href="/contact" passHref>
            <A
              css={{
                textDecoration: "none",
                fontWeight: 500,
                display: "flex",
                color: "white",
                ai: "center",
                ".HoverArrow": {
                  position: "relative",
                  top: "1px",
                  marginLeft: "4px",
                  strokeWidth: "2",
                  fill: "none",
                  stroke: "currentColor",
                },
                ".HoverArrow__linePath": {
                  opacity: "0",
                  transition: "opacity cubic-bezier(0.215,0.61,0.355,1) .1s",
                },
                ".HoverArrow__tipPath": {
                  transition:
                    "transform cubic-bezier(0.215,0.61,0.355,1) .1s, transform cubic-bezier(0.215,0.61,0.355,1) .1s",
                },
                "&:hover .HoverArrow": {
                  transition: "cubic-bezier(0.215,0.61,0.355,1) .1s",
                  ".HoverArrow__linePath": {
                    opacity: 1,
                  },
                  ".HoverArrow__tipPath": {
                    transform: "translateX(3px)",
                  },
                },
              }}>
              <Box>Contact us</Box>
              <svg
                className="HoverArrow"
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden="true">
                <g fillRule="evenodd">
                  <path className="HoverArrow__linePath" d="M0 5h7" />
                  <path className="HoverArrow__tipPath" d="M1 1l4 4-4 4" />
                </g>
              </svg>
            </A>
          </Link>
        </Flex>
      </Box>
    </Container>
  </Box>
);

export default Prefooter;
