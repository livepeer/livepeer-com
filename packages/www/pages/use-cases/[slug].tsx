import Layout from "layouts/redesign";
import Hero from "components/Redesign/Hero";
import Why from "components/Redesign/Why";
import CaseStudy from "components/Redesign/CaseStudy";
import Prefooter from "components/Redesign/Prefooter";
import { GraphQLClient, request } from "graphql-request";
import { print } from "graphql/language/printer";
import allUseCases from "../../queries/allUseCases.gql";
import { useRouter } from "next/router";
import { Box } from "@livepeer.com/design-system";

const UseCase = ({ hero, why, caseStudy, preview }) => {
  const router = useRouter();
  if (router.isFallback) {
    return (
      <Layout>
        <Box
          sx={{
            py: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
          Loading
        </Box>
      </Layout>
    );
  }

  return (
    <Layout preview={preview}>
      <Hero
        heading={hero.heading}
        description={hero.description}
        image={hero.image.asset.url}
      />
      <Why heading={why.heading} reasons={why.reasons} />
      <CaseStudy
        heading={caseStudy.heading}
        about={caseStudy.about}
        problem={caseStudy.problem}
        solution={caseStudy.solution}
        image={caseStudy.image.asset.url}
        internalLink={caseStudy.internalLink}
      />
      <Prefooter />
    </Layout>
  );
};

export async function getStaticPaths() {
  const { allUseCase } = await request(
    "https://dp4k3mpw.api.sanity.io/v1/graphql/production/default",
    print(allUseCases),
    {
      where: {},
    }
  );
  let paths = [];
  for (const useCase of allUseCase) {
    paths.push({ params: { slug: useCase.slug.current } });
  }

  return {
    fallback: true,
    paths,
  };
}

export async function getStaticProps({ params }) {
  const { slug } = params;
  const graphQLClient = new GraphQLClient(
    "https://dp4k3mpw.api.sanity.io/v1/graphql/production/default"
  );

  let data: any = await graphQLClient.request(print(allUseCases), {
    where: {
      slug: { current: { eq: slug } },
    },
  });

  let useCase = data.allUseCase.find((p) => p.slug.current === slug);

  return {
    props: {
      ...useCase,
    },
    revalidate: 1,
  };
}

export default UseCase;
