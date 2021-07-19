import Logo from "components/Redesign/Logo";
import {
  Container,
  Text,
  Box,
  Grid,
  Label,
  TextField,
  Button,
  Link as A,
} from "@livepeer.com/design-system";
import LinksList, { LinksListProps } from "./LinksList";
import { useState, useEffect } from "react";
import { useApi, useMailchimp } from "hooks";
import Link from "next/link";
import Guides from "components/Redesign/Guides";
import { ArrowRightIcon } from "@radix-ui/react-icons";

const linksLists: LinksListProps[] = [
  {
    heading: "Company",
    links: [
      { children: "Home", href: "/" },
      { children: "Contact", href: "/contact" },
      { children: "Team", href: "/team" },
      { children: "Jobs", href: "/jobs" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { children: "Documentation", href: "/docs/guides" },
      { children: "Status Page", href: "https://livepeer.statuspage.io/" },
      { children: "Blog", href: "/blog" },
      { children: "Privacy Policy", href: "/privacy-policy" },
      { children: "Terms of Service", href: "/terms-of-service" },
    ],
  },
];

const MailchimpResponse = ({
  result,
  msg,
}: {
  result?: string;
  msg?: string;
}) => {
  if (!result || !msg) return null;

  const message = msg.includes("is already subscribed to list")
    ? msg.split(" <a href=")[0]
    : msg;

  return (
    <Text
      css={{
        fontWeight: 500,
        fontSize: "$2",
        ml: "$2",
        mr: "auto",
        color: "$hiContrast",
        position: "absolute",
        transform: "none",
        left: 0,
        bottom: "-32px",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        overflow: "hidden",
        width: "90%",
      }}>
      {message}
    </Text>
  );
};

const Footer = () => {
  const [version, setVersion] = useState({ tag: "", commit: "" });
  const { user, getVersion } = useApi();
  const [email, setEmail] = useState("");
  const [mailchimp, subscribe] = useMailchimp({
    url: "https://livepeer.us16.list-manage.com/subscribe/post?u=57807e9b74db375864b2c4c68&id=5b12d9c158",
  });

  // @ts-ignore
  const { data: mailchimpResponseData } = mailchimp;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      getVersion().then((v) => setVersion(v));
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // @ts-ignore
    subscribe({ EMAIL: email });
  };

  return (
    <Box>
      <Guides backgroundColor="$loContrast" />
      <Box css={{ position: "relative", py: 120 }}>
        <Container size="3" css={{ px: "$4", width: "100%" }}>
          <Grid
            gap={6}
            css={{
              grid: "1fr/repeat(4,1fr)",
              ai: "flex-start",
              justifyContent: "center",
              textAlign: "left",
            }}>
            <Box
              as="form"
              onSubmit={handleSubmit}
              css={{ position: "relative" }}>
              <Logo isDark />
              <Text
                variant="gray"
                css={{
                  pb: "$3",
                  display: "block",
                  mt: "$4",
                  maxWidth: "276px",
                  mx: 0,
                }}>
                Join our newsletter to stay up to date on features and new
                releases.
              </Text>
              <Box
                css={{
                  position: "relative",
                  width: "fit-content",
                  mx: 0,
                }}>
                <TextField
                  size="2"
                  placeholder="Enter your email"
                  name="email"
                  id="email-footer"
                  css={{ py: "$4", pr: 60 }}
                  type="email"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  value={email}
                  required
                />
                <Button
                  css={{
                    position: "absolute",
                    top: "50%",
                    transform: "translateY(-50%)",
                    right: "1px",
                    height: 38,
                    width: 38,
                    border: 0,
                    boxShadow: "none",
                    color: "$hiContrast",
                    cursor: "pointer",
                    "&:hover": {
                      boxShadow: "none",
                    },
                  }}
                  type="submit">
                  <ArrowRightIcon />
                </Button>
              </Box>
              {mailchimpResponseData && (
                <MailchimpResponse {...mailchimpResponseData} />
              )}
            </Box>
            {linksLists.map((list) => (
              <LinksList key={`links-list-${list.heading}`} {...list} />
            ))}
            <Box css={{ color: "$hiContrast" }}>
              <Box css={{ fontWeight: 600, mb: "$3" }}>Livepeer, Inc.</Box>
              <Box css={{ lineHeight: 1.5 }}>
                223 Bedford Ave PMB 530
                <br />
                Brooklyn, NY 11211
              </Box>
              <Box css={{ mt: "$4", mb: "$5" }}>
                <Link href="mailto:hello@livepeer.com" passHref>
                  <A>hello@livepeer.com</A>
                </Link>
              </Box>
              <Box>
                <Link href="https://www.linkedin.com/company/livepeer">
                  <a>
                    <Box
                      as="svg"
                      width="32"
                      height="32"
                      viewBox="0 0 32 32"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      css={{ display: "inline-block", mr: "$2" }}>
                      <Box
                        css={{ fill: "$violet9" }}
                        as="path"
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32ZM10.6776 12.2644C11.7243 12.2644 12.3753 11.5386 12.3753 10.6332C12.3564 9.70605 11.7243 8.99934 10.6971 9C9.67116 9 9 9.70605 9 10.6332C9 11.538 9.6504 12.2651 10.6581 12.2644H10.6776ZM12.1778 22.9993H9.17612V13.5548H12.1778V22.9993ZM16.8394 14.8932C17.2401 14.2484 17.9528 13.3337 19.5448 13.3337C21.5187 13.3337 23.0006 14.682 23 17.5852V23H19.999V17.9464C19.999 16.6778 19.5643 15.8098 18.4767 15.8098C17.6502 15.8098 17.1558 16.3974 16.9382 16.9594C16.8577 17.1627 16.8394 17.4411 16.8394 17.7253V23H13.8384C13.8384 23 13.8774 14.4405 13.8384 13.5555H16.8394V14.8932ZM16.8394 14.8932C16.8344 14.9037 16.8275 14.9143 16.8199 14.9235H16.8394V14.8932Z"
                        fill="currentColor"
                      />
                    </Box>
                  </a>
                </Link>
                <Link href="https://twitter.com/livepeerorg">
                  <a>
                    <Box
                      as="svg"
                      width="32"
                      height="32"
                      viewBox="0 0 32 32"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      css={{ display: "inline-block" }}>
                      <Box
                        css={{ color: "$violet9" }}
                        as="path"
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32ZM21.3503 11.8976C21.9313 11.8243 22.4849 11.6615 23 11.4205C22.6149 12.028 22.1279 12.5616 21.5668 12.9887C21.5723 13.1186 21.5751 13.2493 21.5751 13.3806C21.5751 17.3839 18.6861 22 13.4029 22C11.7809 22 10.2711 21.4985 9 20.639C9.2247 20.667 9.45335 20.6813 9.68517 20.6813C11.0308 20.6813 12.2693 20.197 13.2523 19.3845C11.9955 19.36 10.9347 18.4842 10.5692 17.2806C10.7446 17.316 10.9245 17.3349 11.1096 17.3349C11.3716 17.3349 11.6253 17.2979 11.8664 17.2287C10.5524 16.9504 9.56232 15.726 9.56232 14.2582C9.56232 14.2455 9.56232 14.2328 9.56253 14.2201C9.94982 14.447 10.3927 14.5833 10.8635 14.599C10.0928 14.0558 9.58573 13.1285 9.58573 12.0775C9.58573 11.5223 9.72737 11.002 9.97461 10.5545C11.3913 12.3873 13.5077 13.5934 15.8948 13.7197C15.8459 13.498 15.8204 13.2668 15.8204 13.0294C15.8204 11.3564 17.1065 10 18.6928 10C19.5189 10 20.2653 10.3679 20.7893 10.9567C21.4436 10.8208 22.0583 10.5687 22.6132 10.2216C22.3988 10.9289 21.9434 11.5226 21.3503 11.8976Z"
                        fill="currentColor"
                      />
                    </Box>
                  </a>
                </Link>
              </Box>
              <Box>
                {user && user.admin && version && version.commit && (
                  <Link
                    passHref
                    href={`https://github.com/livepeer/livepeer-com/commit/${version.commit}`}>
                    <A>version {version.commit.substring(0, 8)}</A>
                  </Link>
                )}
              </Box>
            </Box>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
};

export default Footer;
