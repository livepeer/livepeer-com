import {
  Box,
  Flex,
  Container,
  Heading,
  Text,
  Link as A,
  styled,
} from "@livepeer.com/design-system";
import Guides from "components/Redesign/Guides";
import Image from "next/image";
import Link from "next/link";
import Button from "components/Redesign/Button";

const Hero = ({ heading, description, image }) => {
  return (
    <Box>
      <Guides backgroundColor="$loContrast" />
      <Box css={{ position: "relative" }}>
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
            align="center"
            css={{
              mb: 100,
              height: "calc(100vh - 180px)",
              width: "100%",
            }}
            justify="between">
            <Flex direction="column" css={{ maxWidth: 700 }}>
              <Text
                variant="violet"
                size="5"
                css={{ fontWeight: 600, mb: "$5" }}>
                Use cases
              </Text>
              <Box
                css={{
                  fontWeight: 700,
                  fontSize: "$8",
                  lineHeight: 1.3,
                  mb: "$6",
                  "@bp2": {
                    fontSize: "$9",
                    lineHeight: "68px",
                    letterSpacing: "-1px",
                  },
                }}>
                {heading}
              </Box>
              <Text
                size="5"
                variant="gray"
                css={{ mb: "$6", lineHeight: 1.6, maxWidth: 540 }}>
                {description}
              </Text>
              <Flex align="center">
                <Link href="/dashboard" passHref>
                  <Button as="a" arrow css={{ mr: "$4" }}>
                    Get in touch
                  </Button>
                </Link>
                <Link href="/dashboard" passHref>
                  <A
                    css={{
                      textDecoration: "none",
                      fontWeight: 500,
                      display: "flex",
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
                        transition:
                          "opacity cubic-bezier(0.215,0.61,0.355,1) .1s",
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
                    <Box>Start now</Box>
                    <svg
                      className="HoverArrow"
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      aria-hidden="true">
                      <g fillRule="evenodd">
                        <path className="HoverArrow__linePath" d="M0 5h7" />
                        <path
                          className="HoverArrow__tipPath"
                          d="M1 1l4 4-4 4"
                        />
                      </g>
                    </svg>
                  </A>
                </Link>
              </Flex>
            </Flex>
            <Box
              css={{
                mt: 40,
                position: "relative",
                mr: -120,
                display: "none",
                "@bp2": {
                  display: "block",
                },
              }}>
              <Box
                css={{
                  position: "absolute",
                  transform: "translate(-50%)",
                  left: "50%",
                }}>
                <Image src={image} width={542 / 2} height={1096 / 2} />
              </Box>
              <Box
                css={{
                  width: 545,
                  height: 545,
                  minWidth: 545,
                  minHeight: 545,
                  borderRadius: 1000,
                  background:
                    "linear-gradient(90deg, rgba(107, 87, 214, 0.1) 0%, rgba(183, 167, 245, 0.1) 100%)",
                }}
              />
            </Box>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
};

export default Hero;
