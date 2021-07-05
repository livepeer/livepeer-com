import Layout from "../../../../layouts/dashboard";
import {
  Box,
  Button,
  Heading,
  Text,
  Flex,
  AlertDialog,
  AlertDialogTitle,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogAction,
  styled,
} from "@livepeer.com/design-system";
import { useApi, useLoggedIn } from "hooks";
import { useCallback } from "react";
import { useRouter } from "next/router";
import WebhookDialog, { Action } from "@components/Dashboard/WebhookDialog";
import { useToggleState } from "hooks/use-toggle-state";
import { Pencil1Icon, Cross1Icon } from "@radix-ui/react-icons";
import Spinner from "@components/Dashboard/Spinner";
import { useState } from "react";
import { useQuery, useQueryClient } from "react-query";

const Cell = styled(Text, {
  py: "$2",
  fontSize: "$3",
});

const StyledPencil = styled(Pencil1Icon, {
  mr: "$1",
  width: 12,
  height: 12,
});

const StyledCross = styled(Cross1Icon, {
  mr: "$1",
  width: 12,
  height: 12,
});

const ApiKeys = () => {
  useLoggedIn();
  const { user, getWebhook, deleteWebhook, updateWebhook } = useApi();
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const dialogState = useToggleState();
  const { id } = router.query;

  const fetcher = useCallback(async () => {
    const webhook = await getWebhook(id);
    return webhook;
  }, [id]);

  const { data } = useQuery([id], () => fetcher());
  const queryClient = useQueryClient();

  const invalidateQuery = useCallback(() => {
    return queryClient.invalidateQueries(id);
  }, [queryClient, id]);

  return !user || user.emailValid === false ? null : (
    <Layout
      id="developers/webhooks"
      breadcrumbs={[
        { title: "Developers" },
        { title: "Webhooks", href: "/dashboard/developers/webhooks" },
        { title: data?.name },
      ]}>
      <Box css={{ p: "$6" }}>
        <Box css={{ mb: "$8" }}>
          {data && (
            <Box
              css={{
                borderRadius: 6,
                border: "1px solid $colors$mauve7",
              }}>
              <Flex
                css={{
                  p: "$3",
                  width: "100%",
                  borderBottom: "1px solid $colors$mauve7",
                  ai: "center",
                  jc: "space-between",
                }}>
                <Heading size="2">{data.url}</Heading>
                <Flex css={{ ai: "center" }}>
                  <AlertDialog open={deleteDialogOpen}>
                    <Button
                      onClick={() => {
                        setDeleteDialogOpen(true);
                      }}
                      size="2"
                      css={{ mr: "$2", display: "flex", ai: "center" }}
                      variant="red">
                      <StyledCross />
                      Delete
                    </Button>
                    <AlertDialogContent
                      css={{ maxWidth: 450, px: "$5", pt: "$4", pb: "$4" }}>
                      <AlertDialogTitle as={Heading} size="1">
                        Delete Webhook
                      </AlertDialogTitle>
                      <AlertDialogDescription
                        as={Text}
                        size="3"
                        variant="gray"
                        css={{ mt: "$2", lineHeight: "22px" }}>
                        Are you sure you want to delete this webhook?
                      </AlertDialogDescription>
                      <Flex css={{ jc: "flex-end", gap: "$2", mt: "$5" }}>
                        <Button
                          onClick={() => setDeleteDialogOpen(false)}
                          size="2"
                          ghost>
                          Cancel
                        </Button>
                        <AlertDialogAction
                          size="2"
                          as={Button}
                          disabled={deleting}
                          onClick={async () => {
                            setDeleting(true);
                            await deleteWebhook(data.id);
                            await invalidateQuery();
                            setDeleting(false);
                            setDeleteDialogOpen(false);
                            router.push("/dashboard/developers/webhooks");
                          }}
                          variant="red">
                          {deleting && (
                            <Spinner
                              css={{
                                width: 16,
                                height: 16,
                                mr: "$2",
                              }}
                            />
                          )}
                          Delete
                        </AlertDialogAction>
                      </Flex>
                    </AlertDialogContent>
                  </AlertDialog>
                  <WebhookDialog
                    button={
                      <Button
                        size="2"
                        css={{ display: "flex", ai: "center" }}
                        onClick={() => dialogState.onToggle()}>
                        <StyledPencil />
                        Update details
                      </Button>
                    }
                    webhook={data}
                    action={Action.Update}
                    isOpen={dialogState.on}
                    onOpenChange={dialogState.onToggle}
                    onSubmit={async ({ event, name, url }) => {
                      await updateWebhook(data.id, {
                        ...data,
                        event: event ? event : data.event,
                        name: name ? name : data.name,
                        url: url ? url : data.url,
                      });
                      await invalidateQuery();
                    }}
                  />
                </Flex>
              </Flex>

              <Box
                css={{
                  display: "grid",
                  alignItems: "center",
                  gridTemplateColumns: "12em auto",
                  width: "100%",
                  fontSize: "$2",
                  position: "relative",
                  p: "$3",
                  borderBottomLeftRadius: 6,
                  borderBottomRightRadius: 6,
                  backgroundColor: "$panel",
                }}>
                <Cell variant="gray">URL</Cell>
                <Cell>{data.url}</Cell>
                <Cell variant="gray">Name</Cell>
                <Cell>{data.name}</Cell>
                <Cell variant="gray">Created</Cell>
                <Cell>{data.createdAt}</Cell>
                <Cell variant="gray">Event types</Cell>
                <Cell css={{ fontFamily: "monospace" }}>{data.event}</Cell>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Layout>
  );
};

export default ApiKeys;
