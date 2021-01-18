import { useEffect, useRef, useState, useCallback } from "react";
import readingTime from "reading-time";
import { blocksToText, getMaxLines } from "../../lib/utils";
import Link from "next/link";
import { Flex, Box, Link as A } from "@theme-ui/components";
import imageUrlBuilder from "@sanity/image-url";
import { SxStyleProp } from "theme-ui";

import client from "../../lib/client";

// Super hardcoded values to calculate the excerpt height. Yep.
const cardHeight = 555;
const imageHeight = 220;
const cardContentHeight = cardHeight - imageHeight;
const categoryTagHeight = 15;
const authorHeight = 72;
const footerLinkHeight = 20;
const cardPadding = 24;

const BlogPostCard = ({
  post,
  pushSx,
}: {
  post: any;
  pushSx?: SxStyleProp;
}) => {
  const text = blocksToText(post.contentRaw);
  const stats = readingTime(text);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const excerptRef = useRef<HTMLParagraphElement>(null);
  const [excerptMaxLines, setExcerptMaxLines] = useState<number>();

  const builder = imageUrlBuilder(client as any);

  const getExcerptMaxLines = useCallback(() => {
    if (!titleRef.current || !excerptRef.current) return;
    const maxExcerptHeight =
      cardHeight -
      imageHeight -
      categoryTagHeight -
      authorHeight -
      footerLinkHeight -
      cardPadding * 2 -
      titleRef.current.clientHeight;
    const maxLines = getMaxLines(excerptRef.current, maxExcerptHeight);
    setExcerptMaxLines(maxLines - 1);
  }, [titleRef, excerptRef]);

  useEffect(() => {
    getExcerptMaxLines();
    window.addEventListener("resize", getExcerptMaxLines);

    return () => window.removeEventListener("resize", getExcerptMaxLines);
  }, [getExcerptMaxLines]);

  return (
    <div sx={pushSx}>
      <Link href="/blog/[slug]" as={`/blog/${post.slug.current}`} passHref>
        <A
          sx={{
            width: "100%",
            display: "block",
            textDecoration: "none",
            color: "initial",
            marginRight: "auto",
            cursor: "pointer",
            borderRadius: 24,
            border: "1px solid",
            borderColor: "#F0F0F0",
            overflow: "hidden",
            height: cardHeight,
            transition: "box-shadow .2s",
            ":hover": {
              textDecoration: "none",
              boxShadow:
                "0px 2px 1px rgba(0, 0, 0, 0.04), 0px 16px 40px rgba(0, 0, 0, 0.04)",
            },
          }}>
          {post.mainImage && (
            <img
              alt={post.mainImage?.alt}
              width={150}
              height={200}
              sx={{
                height: imageHeight,
                width: "100%",
                objectFit: "cover",
              }}
              className="lazyload"
              data-src={builder.image(post.mainImage).url()}
            />
          )}
          <Flex
            sx={{
              p: cardPadding,
              flexDirection: "column",
              justifyContent: "space-between",
              height: cardContentHeight,
            }}>
            <div>
              <Box
                sx={{
                  color: "text",
                  textTransform: "uppercase",
                  lineHeight: "15px",
                  fontSize: "12px",
                  letterSpacing: "-0.02em",
                  fontWeight: 600,
                  height: categoryTagHeight,
                }}>
                {post.category.title}
              </Box>
              <Flex
                sx={{
                  alignItems: "center",
                  pt: 3,
                  pb: 24,
                  height: authorHeight,
                }}>
                <img
                  alt={post.author.image?.alt}
                  width={30}
                  height={30}
                  sx={{
                    mt: [2, 0],
                    height: 30,
                    width: 30,
                    borderRadius: 1000,
                    objectFit: "cover",
                    mr: 3,
                  }}
                  className="lazyload"
                  data-src={builder.image(post.author.image).url()}
                />
                <Box
                  sx={{
                    fontWeight: 600,
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}>
                  {post.author.name}
                </Box>
                <Box sx={{ mx: 2, width: "2px", height: 16, bg: "grey" }} />
                <Box
                  sx={{
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}>
                  {stats.text}
                </Box>
              </Flex>
              <h2
                ref={titleRef}
                sx={{
                  fontSize: "20px",
                  lineHeight: "32px",
                  letterSpacing: "-0.03em",
                  fontWeight: 500,
                  pb: 3,
                  transition: "color .3s",
                }}>
                {post.title}
              </h2>
              <Box
                sx={{
                  mb: 3,
                  color: "gray",
                  textOverflow: "ellipsis",
                  WebkitLineClamp: excerptMaxLines,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  display: excerptMaxLines <= 0 ? "none" : "-webkit-box",
                }}
                ref={excerptRef}
                as="p">
                {post.excerpt}
              </Box>
            </div>
            <A as="p" sx={{ fontWeight: 600, margin: 0 }}>
              Read more
            </A>
          </Flex>
        </A>
      </Link>
    </div>
  );
};

export default BlogPostCard;
