import { DefaultSeo } from "next-seo";
import Navigation from "../Navigation";
import Footer from "../Footer";
import { Flex, Box } from "@theme-ui/components";
import { useEffect } from "react";
import ReactGA from "react-ga";
import "lazysizes";
import "lazysizes/plugins/attrchange/ls.attrchange";
import Router, { useRouter } from "next/router";
import GradientBackgroundBox from "../GradientBackgroundBox";

interface Props {
  title?: string;
  children?: JSX.Element[] | JSX.Element;
  description?: string;
  image?: any;
  url?: string;
  preview?: boolean;
  withGradientBackground?: boolean;
}

if (process.env.NODE_ENV === "production") {
  ReactGA.initialize(process.env.NEXT_PUBLIC_GA_TRACKING_ID);
} else {
  ReactGA.initialize("test", { testMode: true });
}

// Track client-side page views with Segment & HubSpot
if (process.env.NODE_ENV === "production") {
  Router.events.on("routeChangeComplete", (url) => {
    window.analytics.page();
    var _hsq = (window["hsq"] = window["hsq"] || []);
    _hsq.push(["setPath", url]);
    _hsq.push(["trackPageView"]);
  });
}

const Layout = ({
  title,
  description,
  children,
  image,
  url,
  preview,
  withGradientBackground
}: Props) => {
  const { asPath } = useRouter();
  useEffect(() => {
    ReactGA.pageview(window.location.pathname + window.location.search);
  }, []);

  const seo = {
    title: title,
    description: description,
    openGraph: {
      title: title ? title : "Live Video Transcoding - Livepeer.com",
      description: description
        ? description
        : "Scalable, secure live transcoding at a fraction of the cost",
      url: url ? url : "https://livepeer.com",
      images: [
        {
          url: image ? image.url : "https://livepeer.com/img/share-icon.png",
          alt: image ? image.alt : "Live Video Transcoding - Livepeer.com"
        }
      ]
    }
  };
  return (
    <Flex
      sx={{
        minHeight: "100vh",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <DefaultSeo {...seo} />
      {withGradientBackground && (
        <div sx={{ position: "absolute", top: 0, width: "100%" }}>
          <GradientBackgroundBox
            id="layout"
            gradient="violet"
            sx={{ height: "1000px" }}
            slide
          />
        </div>
      )}
      <Flex
        sx={{
          flexGrow: 1,
          flexDirection: "column",
          justifyContent: "flex-start",
          zIndex: 1
        }}
      >
        <Box
          sx={{
            bg: "transparent",
            zIndex: 20,
            position: "sticky",
            top: 0,
            width: "100%"
          }}
        >
          {preview && (
            <a
              href={`/api/exit-preview?path=${asPath}`}
              sx={{
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
                justifyContent: "center",
                height: 24,
                fontSize: 12,
                fontWeight: "500",
                bg: "extremelyBlue",
                color: "white",
                lineHeight: "32px"
              }}
            >
              Preview Mode — Click to Exit
            </a>
          )}
          <Navigation />
        </Box>
        {children}
      </Flex>
      <Footer />
    </Flex>
  );
};

export default Layout;
