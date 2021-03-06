/** @jsx jsx */
import { jsx } from "theme-ui";
import Link from "next/link";
import { Link as A, Box } from "@theme-ui/components";
import { SxStyleProp } from "theme-ui";

type Props = {
  img: { src: string; alt?: string; sx?: SxStyleProp };
  link: { href: string; asPath?: string };
  title: string;
  description?: string;
  className?: string;
};

const DocsCategoryCard = ({
  img,
  link,
  title,
  description,
  className,
}: Props) => (
  <Link href={link.href} as={link.asPath} passHref>
    <A
      className={className}
      sx={{
        background: "linear-gradient(212.62deg, #1C1C1C 0%, #292935 100%)",
        borderRadius: 16,
        width: 276,
        px: 24,
        py: 32,
        display: "block",
        textAlign: "left",
        boxShadow:
          "0px 2px 2px rgba(0, 0, 0, 0.2), 0px 0px 8px rgba(0, 0, 0, 0.03), 0px 30px 30px rgba(0, 0, 0, 0.02)",
        transition: "box-shadow .2s",
        "&:hover": {
          textDecoration: "none",
          boxShadow:
            "0px 24px 40px rgba(0, 0, 0, 0.24), 0px 30px 30px rgba(0, 0, 0, 0.02)",
        },
      }}>
      <Box
        sx={{
          width: "100%",
          height: "156px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
        }}>
        <Box as="img" {...img} sx={{ ...img.sx }} />
      </Box>
      <Box
        as="h3"
        sx={{
          color: "background",
          fontSize: "20px",
          fontWeight: 600,
          lineHeight: 1.2,
          mb: 2,
          letterSpacing: "-0.03em",
        }}>
        {title}
      </Box>
      {description && (
        <Box
          as="p"
          sx={{
            color: "#A5A5A5",
            fontSize: "18px",
            lineHeight: "24px",
            letterSpacing: "-0.03em",
          }}>
          {description}
        </Box>
      )}
    </A>
  </Link>
);

export default DocsCategoryCard;
