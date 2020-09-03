import { Container, Flex, Link as A } from '@theme-ui/components';
import { GraphQLClient, request } from 'graphql-request';
import { print } from 'graphql/language/printer';
import ReactMarkdown from 'react-markdown';
import Fade from 'react-reveal/Fade';

import Button from '../../components/Button';
import Layout from '../../components/Layout';
import Prefooter from '../../components/Prefooter';
import allJobs from '../../queries/allJobs.gql';

const Page = ({ title, body, preview }) => {
  return (
    <Layout
      title={`${title} - Livepeer.com`}
      description={`Join Us. From Anywhere.`}
      url={`https://livepeer.com/jobs`}
      preview={preview}
    >
      <Container
        sx={{
          pb: 5,
          ul: { mb: 4 },
          p: { mb: 4 }
        }}
      >
        <h1 sx={{ lineHeight: "72px", my: 5 }}>{title}</h1>
        <Flex sx={{ maxWidth: 1200, margin: "0 auto" }}>
          <ReactMarkdown className="markdown-body" sx={{ flex: "1 1 auto" }}>
            {body}
          </ReactMarkdown>
          <A
            sx={{
              display: "block",
              flex: "1 0 auto",
              alignSelf: "flex-start",
              width: "380px",
              ml: 4,
              p: 4,
              textDecoration: "none",
              color: "initial",
              marginRight: "auto",
              cursor: "pointer",
              borderRadius: 24,
              border: "1px solid",
              borderColor: "#F0F0F0",
              backgroundColor: "#FFF",
              overflow: "hidden",
              transition: "box-shadow .2s",
              ":hover": {
                textDecoration: "none",
                boxShadow:
                  "0px 2px 1px rgba(0, 0, 0, 0.04), 0px 16px 40px rgba(0, 0, 0, 0.04)"
              }
            }}
          >
            <p sx={{ fontSize: 20, mb: 0 }}>How to Apply</p>
            <p sx={{ color: "gray" }}>
              If you are interested in applying for this position, please send
              an email containing your Github profile and/or LinkedIn.
            </p>
            <Button
              isExternal
              href="mailto:jobs@livepeer.com"
              sx={{ width: "100%" }}
            >
              Send email
            </Button>
          </A>
        </Flex>
      </Container>
      <Fade key={0}>
        <Prefooter />
      </Fade>
    </Layout>
  );
};

export async function getStaticPaths() {
  const { allJob } = await request(
    "https://dp4k3mpw.api.sanity.io/v1/graphql/production/default",
    print(allJobs),
    {
      where: {}
    }
  );
  let paths = [];
  allJob.map((page) => paths.push({ params: { slug: page.slug.current } }));
  return {
    fallback: true,
    paths
  };
}

export async function getStaticProps({ params, preview = false }) {
  const graphQLClient = new GraphQLClient(
    "https://dp4k3mpw.api.sanity.io/v1/graphql/production/default"
  );

  let data: any = await graphQLClient.request(print(allJobs), {
    where: {
      slug: { current: { eq: params.slug } }
    }
  });

  return {
    props: {
      ...data.allJob[0],
      preview: false
    },
    revalidate: 1
  };
}

export default Page;
