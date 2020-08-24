import { Styled } from "theme-ui";
import { Grid, Flex, Container, Box, Link as A } from "@theme-ui/components";
import imageUrlBuilder from "@sanity/image-url";
import client from "../../lib/client";
import { Link as ScrollLink } from "react-scroll";
import ArrowRight from "../../public/img/arrow-right.svg";
import Link from "next/link";

type Props = {
  heading?: string;
  tagline?: string;
  centered?: boolean;
  skinny?: boolean;
  image?: any;
  ctas?: [];
};

const Hero = ({
  heading,
  tagline,
  centered = false,
  skinny = false,
  image,
  ctas,
  ...props
}: Props) => {
  const builder = imageUrlBuilder(client as any);
  return (
    <Box
      sx={{
        mt: [5, 5, 5, 0],
        overflow: "hidden",
        borderBottom: skinny ? "0" : "1px solid",
        borderColor: "muted",
        pt: skinny ? 4 : 0,
        pb: skinny ? 4 : "65px"
      }}
      {...props}
    >
      <Container
        sx={{
          minHeight: ["auto", "auto", skinny ? 200 : "calc(100vh - 130px)"],
          display: "flex",
          flexDirection: "column",
          justifyContent: "center"
        }}
      >
        <Box
          sx={{
            mb: [4, 4, 4, 0],
            maxWidth: 1000,
            mx: "auto",
            textAlign: "center"
          }}
        >
          <Styled.h1
            sx={{
              fontSize: [48, 56, 64, 72]
            }}
          >
            <span sx={{ fontWeight: 400 }}>The platform built to power</span>
            <br />
            video-centric UGC applications at scale.
          </Styled.h1>
          {ctas && (
            <Flex
              sx={{
                mt: "44px",
                flexDirection: ["column", "row"],
                justifyContent: "center",
                width: "100%",
                alignItems: "center"
              }}
            >
              {ctas.map((cta, i) => (
                <Box key={i}>{renderSwitch(cta)}</Box>
              ))}
            </Flex>
          )}
        </Box>
      </Container>
    </Box>
  );
};

function renderSwitch(cta) {
  switch (true) {
    case !!cta.internalLink?.slug?.current:
      return (
        <Link href={cta.internalLink?.slug?.current} passHref>
          <A variant="buttons.secondary">{cta.title}</A>
        </Link>
      );
    case !!cta.externalLink:
      return (
        <A
          sx={{ display: "flex", alignItems: "center" }}
          variant={cta.variant}
          target="__blank"
          href={cta.externalLink}
        >
          {cta.title}
          <ArrowRight sx={{ ml: 2 }} />
        </A>
      );
    default:
      return (
        <ScrollLink offset={-40} to={cta.anchorLink} spy smooth>
          <Box
            variant="buttons.secondary"
            sx={{ mr: [0, 0, 4], mb: [3, 3, 0] }}
          >
            {cta.title}
          </Box>
        </ScrollLink>
      );
  }
}

export default Hero;
