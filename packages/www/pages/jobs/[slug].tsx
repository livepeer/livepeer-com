import Layout from "../../components/Layout";
import { GraphQLClient, request } from "graphql-request";
import { print } from "graphql/language/printer";
import allJobs from "../../queries/allJobs.gql";
import { Container } from "@theme-ui/components";
import ReactMarkdown from "react-markdown";

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
          p: { mb: 4 },
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        <h1 sx={{ lineHeight: "72px", my: 5 }}>{title}</h1>
        <ReactMarkdown className="markdown-body">{body}</ReactMarkdown>
      </Container>
    </Layout>
  );
};

export async function getStaticPaths() {
  const { allJob } = await request(
    "https://dp4k3mpw.api.sanity.io/v1/graphql/production/default",
    print(allJobs),
    {
      where: {},
    }
  );
  let paths = [];
  allJob.map((page) => paths.push({ params: { slug: page.slug.current } }));
  return {
    fallback: true,
    paths,
  };
}

export async function getStaticProps({ params, preview = false }) {
  const graphQLClient = new GraphQLClient(
    "https://dp4k3mpw.api.sanity.io/v1/graphql/production/default"
  );

  let data: any = await graphQLClient.request(print(allJobs), {
    where: {
      slug: { current: { eq: params.slug } },
    },
  });

  return {
    props: {
      ...data.allJob[0],
      preview: false,
    },
    revalidate: 1,
  };
}

export default Page;
