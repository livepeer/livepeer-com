import Link from "next/link";
import { useEffect, useState } from "react";
import { useApi } from "../../hooks";
import { StreamInfo, Ingest } from "../../hooks/use-api";
import {
  Select,
  Container,
  Box,
  Button,
  Flex,
  Grid,
  Input
} from "@theme-ui/components";
import Modal from "../Modal";
import { Table, TableRow, TableRowVariant, Checkbox } from "../Table";
import { UserName } from "../AdminTokenTable";
import { User, Webhook } from "@livepeer.com/api";
import moment from "moment";
import { FaInfo } from "react-icons/fa";

const AdminTools = ({ id }: { id: string }) => {
  const [message, setMessage] = useState("");
  const [idInput, setIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [desc, setDesc] = useState("");
  const [ingest, setIngest] = useState([]);
  const [ginfo, setInfo] = useState<StreamInfo | null>(null);
  const [users, setUsers] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const { getUsers, getStreamInfo, getIngest } = useApi();
  useEffect(() => {
    getIngest(true)
      .then((_ingest) => setIngest(_ingest))
      .catch((err) => {
        console.log(err);
        setMessage(`${err}`);
      });
  }, [id]);
  useEffect(() => {
    getUsers(10000)
      .then((users) => {
        if (Array.isArray(users)) {
          users.sort((a, b) => a.email.localeCompare(b.email));
          setUsers(users);
          setUsersMap(users.reduce((a, cv) => (a[cv.email] = cv), {}));
        } else {
          setMessage(`${users}`);
        }
      })
      .catch((err) => {
        console.error(err);
        setMessage(err);
      });
  }, []);
  const doGetInfo = async (id: string) => {
    setLoading(true);
    setInfo(null);
    setDesc("");
    setMessage("Loading");
    const [res, rinfo] = await getStreamInfo(id.trim());
    if (!rinfo || rinfo.isSession === undefined) {
      setMessage("Not found");
    } else if (rinfo.stream && rinfo.user) {
      const info = rinfo as StreamInfo;
      setInfo(info);
      setMessage("");
      let ago = moment.unix(info.stream.createdAt / 1000.0).fromNow();
      let byToken = "";
      if (info.stream.createdByTokenName) {
        byToken = `(using token '${info.stream.createdByTokenName})`;
      }
      let dsc = `Stream ${info.stream.name} by ${info.user.email} ${byToken} created ${ago}. Seconds streamed ${info.stream.sourceSegmentsDuration}.`;
      if (info.session) {
        const ago1 = moment.unix(info.session.createdAt / 1000.0).fromNow();
        const ago2 = moment.unix(info.session.lastSeen / 1000.0).fromNow();
        dsc += ` Last session created ${ago1}, last seen ${ago2}. Seconds streamed ${info.session.sourceSegmentsDuration}.`;
      }
      setDesc(dsc);
    }

    setLoading(false);
  };
  const query = true ? { admin: true } : {};

  return (
    <Container
      id={id}
      sx={{
        mb: 5,
        mt: 2
      }}
    >
      <Box sx={{ mt: "2em" }}>{message}</Box>
      <Flex sx={{ justifyContent: "flex-start", mt: "2em", mb: "1em" }}>
        <Input
          sx={{ width: "30em" }}
          label="idInput"
          value={idInput}
          onChange={(e) => setIdInput(e.target.value)}
          placeholder="streamKey/playbackId/manifestId"
        ></Input>
        <Button
          variant="secondarySmall"
          aria-label="Get info button"
          disabled={loading || !idInput}
          sx={{ ml: "1em" }}
          onClick={() => doGetInfo(idInput)}
        >
          Get info
        </Button>
      </Flex>
      <Box>{desc}</Box>
      {ginfo && ginfo.stream && (
        <>
          <Box>
            Stream link:
            <Link
              href={{ pathname: "/app/stream/[id]", query }}
              as={`/app/stream/${ginfo.stream.id}`}
            >
              <a>{ginfo.stream.name}</a>
            </Link>
          </Box>
          <Box>
            <a
              target="_blank"
              href={`https://papertrailapp.com/groups/16613582/events?q=${ginfo.stream.streamKey}`}
            >
              Papertrail link to stream key ({ginfo.stream.streamKey})
            </a>
          </Box>
          <Box>
            <a
              target="_blank"
              href={`https://papertrailapp.com/groups/16613582/events?q=${ginfo.stream.playbackId}`}
            >
              Papertrail link to playback id ({ginfo.stream.playbackId})
            </a>
          </Box>
          <Box>
            <a
              target="_blank"
              href={`https://papertrailapp.com/groups/16613582/events?q=${ginfo.stream.id}`}
            >
              Papertrail link to stream id ({ginfo.stream.id})
            </a>
          </Box>
          {ginfo && ginfo.session && (
            <Box>
              <a
                target="_blank"
                href={`https://papertrailapp.com/groups/16613582/events?q=${ginfo.session.id}`}
              >
                Papertrail link to session id ({ginfo.session.id})
              </a>
            </Box>
          )}
          {ingest.map((ingestPoint: Ingest) => {
            return (
              <>
                <Box>
                  Ingest link
                  <pre>{`${ingestPoint.ingest}/${ginfo.stream.streamKey}`}</pre>
                </Box>
                <Box>
                  <a
                    target="_blank"
                    href={`${ingestPoint.playback}/${ginfo.stream.playbackId}/index.m3u8`}
                  >
                    Playback link (
                    {`${ingestPoint.playback}/${ginfo.stream.playbackId}/index.m3u8`})
                  </a>
                </Box>
              </>
            );
          })}
        </>
      )}
    </Container>
  );
};
export default AdminTools;