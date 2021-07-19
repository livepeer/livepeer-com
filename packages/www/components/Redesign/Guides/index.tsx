import { Box } from "@livepeer.com/design-system";

const Guides = ({ backgroundColor = "$panel" }) => {
  return (
    <Box
      css={{
        position: "absolute",
        width: "100%",
        height: "100%",
      }}>
      <Box
        css={{
          position: "relative",
          height: "100%",
          width: "100%",
          top: "0",
          left: "0",
          overflow: "hidden",
          backgroundColor,
        }}>
        <Box
          css={{
            position: "absolute",
            height: "100%",
            width: "100%",
            top: "0",
            left: "0",
            px: "$4",
            pointerEvents: "none",
          }}>
          <Box
            css={{
              display: "grid",
              grid: "1fr/repeat(2,1fr)",
              position: "relative",
              maxWidth: "1145px",
              height: "100%",
              margin: "0 auto",
              "@bp2": {
                grid: "1fr/repeat(4,1fr)",
              },
            }}>
            <Box
              css={{
                width: "1px",
                background: "$mauve4",
                backgroundSize: "1px 8px",
              }}
            />
            <Box
              css={{
                width: "1px",
                background:
                  "linear-gradient(180deg, $colors$mauve4, $colors$mauve4 50%,transparent 0,transparent)",
                backgroundSize: "1px 8px",
                display: "none",
                "@bp2": {
                  display: "block",
                },
              }}
            />
            <Box
              css={{
                width: "1px",
                background:
                  "linear-gradient(180deg, $colors$mauve4, $colors$mauve4 50%,transparent 0,transparent)",
                backgroundSize: "1px 8px",
                display: "none",
                "@bp1": {
                  display: "block",
                },
              }}
            />
            <Box
              css={{
                width: "1px",
                background:
                  "linear-gradient(180deg, $colors$mauve4, $colors$mauve4 50%,transparent 0,transparent)",
                backgroundSize: "1px 8px",
                display: "none",
                "@bp2": {
                  display: "block",
                },
              }}
            />
            <Box
              css={{
                width: "1px",
                background: "$mauve4",
                backgroundSize: "1px 8px",
                position: "absolute",
                top: "0",
                right: "0",
                height: "100%",
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Guides;
